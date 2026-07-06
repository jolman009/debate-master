import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getAnthropicClient, CLAUDE_MODEL } from "@/lib/anthropic";
import {
  buildFeedbackPrompt,
  FEEDBACK_SYSTEM_PROMPT,
} from "@/lib/debate/prompt-builder";
import { DebateTurn } from "@/lib/debate/types";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { reportError } from "@/lib/observability";

// Allow time for the (non-streamed) feedback generation call.
export const maxDuration = 60;

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

  // Load debate — ownership-scoped so non-owners can't burn tokens on
  // someone else's transcript or overwrite their feedback.
  const { data: debate, error: debateError } = await supabase
    .from("debates")
    .select("*")
    .eq("id", params.debateId)
    .eq("user_id", user.id)
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

  const anthropic = getAnthropicClient();
  const transcript = buildFeedbackPrompt(turns as DebateTurn[]);

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      system: FEEDBACK_SYSTEM_PROMPT,
      messages: [{ role: "user", content: transcript }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    let feedback;
    try {
      feedback = JSON.parse(text);
    } catch {
      feedback = {
        overallScore: 5,
        argumentStrength: 5,
        evidenceUsage: 5,
        rebuttalQuality: 5,
        rhetoricalSkill: 5,
        summary: text,
        strengths: ["Completed the debate"],
        improvements: ["Could not parse structured feedback"],
      };
    }

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
