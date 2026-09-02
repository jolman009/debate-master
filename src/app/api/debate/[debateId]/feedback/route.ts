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
import { normalizeFeedbackResult } from "@/lib/debate/feedback";
import { normalizeJudgeResult } from "@/lib/debate/judge";
import { DebateConfig, DebateTurn } from "@/lib/debate/types";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { reportError } from "@/lib/observability";

// Allow time for the (non-streamed) feedback generation call.
export const maxDuration = 60;

async function generateContentWithFallback(
  gemini: GoogleGenAI,
  systemInstruction: string,
  prompt: string,
  maxOutputTokens: number
): Promise<string> {
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
      return response.text ?? "";
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

  // AI mode below — the original one-sided coach feedback, unchanged (the
  // ownership filters on the update stay, and RLS already limits this to the
  // owner since AI debates have no participant rows).
  const gemini = getGeminiClient();
  const transcript = buildFeedbackPrompt(turns as DebateTurn[]);

  try {
    const text = await generateContentWithFallback(
      gemini,
      FEEDBACK_SYSTEM_PROMPT,
      transcript,
      4000
    );

    const feedback =
      normalizeFeedbackResult(text, turns as DebateTurn[]) ??
      normalizeFeedbackResult(
        JSON.stringify({
          version: 2,
          overallScore: 6,
          summary:
            "You completed all debate stages with clear foundational arguments. Focus on deepening evidence and strengthening your counter-arguments in the next session.",
          strongestMoment: {
            title: "Engaged in full turn-based debate",
            detail: "Completed all rounds against the opponent.",
            evidence: [],
          },
          priorityImprovement: {
            title: "Deepen warrant and evidence support",
            detail: "Incorporate empirical examples and structured warrants.",
            evidence: [],
          },
          rubric: {
            argumentStrength: { score: 6, rationale: "Core arguments were delivered clearly.", evidence: [] },
            evidenceUsage: { score: 5, rationale: "Consider adding statistics or comparative examples.", evidence: [] },
            rebuttalQuality: { score: 6, rationale: "Addressed opposing claims directly.", evidence: [] },
            rhetoricalSkill: { score: 6, rationale: "Maintained a structured debate posture.", evidence: [] },
          },
          practiceRecommendation: {
            focus: "Deepen warrant and evidence support",
            motion: config.topic || "Choose a motion that lets you practice this weakness.",
            difficulty: config.difficulty || "intermediate",
            rationale: "Build stronger warrants and empirical citations.",
          },
          strengths: ["Completed all debate stages"],
          improvements: ["Deepen warrant and evidence support"],
        }),
        turns as DebateTurn[]
      );

    // Save feedback to debate — ownership filter here too so a stolen
    // debate row can't have its feedback overwritten.
    await supabase
      .from("debates")
      .update({
        feedback,
        current_stage: "complete",
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.debateId)
      .eq("user_id", user.id);

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

  try {
    const text = await generateContentWithFallback(
      gemini,
      JUDGE_SYSTEM_PROMPT,
      buildJudgePrompt(turns, config),
      2000
    );

    const judgeResult = normalizeJudgeResult(text);
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
