import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import { createServerClient } from "@/lib/supabase/server";
import {
  getGeminiClient,
  GEMINI_FALLBACK_MODELS,
  isRetryableGeminiError,
} from "@/lib/gemini";
import {
  buildFeedbackPrompt,
  buildJudgePrompt,
  FEEDBACK_SYSTEM_PROMPT,
  JUDGE_SYSTEM_PROMPT,
} from "@/lib/debate/prompt-builder";
import { isMeasuredScore, normalizeFeedbackResult } from "@/lib/debate/feedback";
import { extractJson, normalizeJudgeResult } from "@/lib/debate/judge";
import { DebateConfig, DebateTurn } from "@/lib/debate/types";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { measurementEnabled } from "@/lib/measurement-flags";
import { RUBRIC_VERSION, PROMPT_VERSION, RUBRIC_ANCHORS } from "@/lib/debate/rubric";
import { reportError } from "@/lib/observability";

// Allow time for the (non-streamed) feedback generation call.
export const maxDuration = 60;

async function generateContentWithFallback(
  gemini: GoogleGenAI,
  systemInstruction: string,
  prompt: string,
  maxOutputTokens: number
): Promise<{ text: string; model: string; inputTokens: number | null; outputTokens: number | null }> {
  const candidateModels = GEMINI_FALLBACK_MODELS;

  let lastErr: unknown = null;
  for (const model of candidateModels) {
    try {
      const response = await gemini.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction,
          maxOutputTokens,
          responseMimeType: "application/json",
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      });
      return { text: response.text ?? "", model, inputTokens: response.usageMetadata?.promptTokenCount ?? null, outputTokens: response.usageMetadata?.candidatesTokenCount ?? null };
    } catch (err: unknown) {
      lastErr = err;
      if (isRetryableGeminiError(err)) {
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error("Failed to generate response");
}

export async function POST(
  request: Request,
  { params }: { params: { debateId: string } }
) {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rl = await checkRateLimit("ai", user?.id ?? clientIp(request));
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  if (!user) {
    return NextResponse.json(
      { error: "You must be signed in to request feedback" },
      { status: 401 }
    );
  }

  // Load by id and let RLS scope access: AI debates are owner-only (no
  // participant rows), human debates are readable by both participants — the
  // judge can be requested by EITHER player, not just the creator.
  const { data: debate, error: debateError } = await supabase
    .from("debates")
    .select("*")
    .eq("id", params.debateId)
    .single();

  if (debateError || !debate) {
    return NextResponse.json({ error: "Debate not found" }, { status: 404 });
  }

  // Load turns
  const { data: turns } = await supabase
    .from("debate_turns")
    .select("*")
    .eq("debate_id", params.debateId)
    .order("created_at", { ascending: true });

  if (!turns || turns.length === 0) {
    return NextResponse.json({ error: "No turns to evaluate" }, { status: 400 });
  }

  const config = debate.config as DebateConfig;

  if (config.mode === "human") {
    return runHumanJudge(supabase, params.debateId, config, turns as DebateTurn[]);
  }

  // AI coaching is owner-scoped and first-write-wins.
  if (debate.feedback) return NextResponse.json({ feedback: debate.feedback });
  if (!measurementEnabled(user.id)) return NextResponse.json({ error: "Coaching is temporarily unavailable" }, { status: 503 });
  if (debate.current_stage !== "feedback" && debate.current_stage !== "complete") {
    return NextResponse.json({ error: "Finish the debate before requesting coaching" }, { status: 409 });
  }
  const gemini = getGeminiClient();
  const started = Date.now();
  const transcript = buildFeedbackPrompt(turns as DebateTurn[]);

  try {
    const text = await generateContentWithFallback(
      gemini,
      FEEDBACK_SYSTEM_PROMPT + "\n" + RUBRIC_ANCHORS,
      transcript,
      4000
    );

    const feedback = normalizeFeedbackResult(text.text, turns as DebateTurn[]);
    if (!feedback) {
      await supabase.from("debates").update({ assessment_status: "invalid" }).eq("id", params.debateId).eq("user_id", user.id).is("feedback", null);
      reportError(new Error("Invalid coaching evaluation"), { route: "debate/feedback", debateId: params.debateId });
      return NextResponse.json({ error: "The coach returned invalid scores. Please retry." }, { status: 502 });
    }
    feedback.assessment = {
      status: "valid", rubricVersion: RUBRIC_VERSION, promptVersion: PROMPT_VERSION,
      model: text.model, sessionFormat: `ai:${config.rebuttalCycles}:${config.crossExamEnabled}`,
      difficulty: config.difficulty, evaluatedAt: new Date().toISOString(),
      latencyMs: Date.now() - started, inputTokens: text.inputTokens, outputTokens: text.outputTokens,
    };

    // Save feedback to debate — ownership filter here too so a stolen
    // debate row can't have its feedback overwritten.
    const { data: saved, error: saveError } = await supabase
      .from("debates")
      .update({
        feedback,
        assessment_status: "valid",
        current_stage: "complete",
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.debateId)
      .eq("user_id", user.id)
      .is("feedback", null)
      .select("id");
    if (saveError) throw saveError;
    if (!saved?.length) {
      const { data: existing } = await supabase.from("debates").select("feedback").eq("id", params.debateId).single();
      if (!existing?.feedback) throw new Error("Feedback was not saved");
      return NextResponse.json({ feedback: existing.feedback });
    }

    return NextResponse.json({ feedback });
  } catch (err) {
    reportError(err, { route: "debate/feedback", debateId: params.debateId });
    return NextResponse.json(
      { error: "Failed to generate feedback" },
      { status: 500 }
    );
  }
}

/**
 * Human mode: run the neutral two-sided judge and record the verdict.
 *
 * The verdict permanently moves both players' Elo, so it is applied through the
 * apply_judge_result RPC — one transaction, under a per-debate advisory lock,
 * which re-derives the ratings server-side and refuses to judge the same debate
 * twice. An unparseable verdict is an error, never a fabricated result.
 */
async function runHumanJudge(
  supabase: SupabaseClient,
  debateId: string,
  config: DebateConfig,
  turns: DebateTurn[]
) {
  const gemini = getGeminiClient();
  const started = Date.now();

  try {
    const text = await generateContentWithFallback(
      gemini,
      JUDGE_SYSTEM_PROMPT + "\n" + RUBRIC_ANCHORS,
      buildJudgePrompt(turns, config),
      2000
    );

    const rawJudge = extractJson(text.text) as Record<string, Record<string, unknown>> | null;
    const hasMeasuredScores = ["pro", "con"].every(side =>
      ["score", "argumentStrength", "evidenceUsage", "rebuttalQuality", "rhetoricalSkill"].every(key =>
        isMeasuredScore(rawJudge?.[side]?.[key])));
    const judgeResult = hasMeasuredScores ? normalizeJudgeResult(text.text) : null;
    if (!judgeResult) {
      reportError(new Error("Judge returned an unusable verdict"), {
        route: "debate/feedback",
        debateId,
        mode: "human",
      });
      return NextResponse.json(
        { error: "The judge could not reach a verdict. Please try again." },
        { status: 502 }
      );
    }

    judgeResult.assessment = {
      status: "valid", rubricVersion: RUBRIC_VERSION, promptVersion: "judge-anchors-1",
      model: text.model, sessionFormat: `human:${config.rebuttalCycles}:${config.crossExamEnabled}`,
      difficulty: config.difficulty, evaluatedAt: new Date().toISOString(),
      latencyMs: Date.now() - started, inputTokens: text.inputTokens, outputTokens: text.outputTokens,
    };

    const { data, error } = await supabase.rpc("apply_judge_result", {
      p_debate_id: debateId,
      p_judge: judgeResult,
    });

    if (error) {
      const message = error.message || "";
      const known =
        /already been judged|not a participant|two players|not a human debate/i.test(
          message
        );
      if (!known) {
        reportError(error, {
          route: "debate/feedback",
          debateId,
          phase: "apply_judge_result",
        });
      }
      return NextResponse.json(
        { error: known ? message : "Failed to record the verdict" },
        { status: known ? 409 : 500 }
      );
    }

    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({
      judgeResult,
      proDelta: row?.pro_delta ?? null,
      conDelta: row?.con_delta ?? null,
    });
  } catch (err) {
    reportError(err, { route: "debate/feedback", debateId, mode: "human" });
    return NextResponse.json(
      { error: "Failed to generate the verdict" },
      { status: 500 }
    );
  }
}
