import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getAnthropicClient } from "@/lib/anthropic";
import {
  buildFeedbackPrompt,
  FEEDBACK_SYSTEM_PROMPT,
} from "@/lib/debate/prompt-builder";
import { DebateTurn } from "@/lib/debate/types";

export async function POST(
  _request: Request,
  { params }: { params: { debateId: string } }
) {
  const supabase = createServerClient();

  // Load debate
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

  const anthropic = getAnthropicClient();
  const transcript = buildFeedbackPrompt(turns as DebateTurn[]);

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
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

    // Save feedback to debate
    await supabase
      .from("debates")
      .update({
        feedback,
        current_stage: "complete",
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.debateId);

    return NextResponse.json({ feedback });
  } catch (err) {
    console.error("Feedback generation error:", err);
    return NextResponse.json(
      { error: "Failed to generate feedback" },
      { status: 500 }
    );
  }
}
