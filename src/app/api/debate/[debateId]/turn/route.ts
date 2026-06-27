import { createServerClient } from "@/lib/supabase/server";
import { getAnthropicClient, CLAUDE_MODEL } from "@/lib/anthropic";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { reportError } from "@/lib/observability";
import { getPersonaBySlug } from "@/lib/debate/content";
import { buildSystemPrompt, buildMessages } from "@/lib/debate/prompt-builder";
import { getNextStage, isUserStage, isAiStage } from "@/lib/debate/state-machine";
import { Debate, DebateConfig, DebateStage, DebateTurn } from "@/lib/debate/types";

// Cap user-submitted turn length before it ever reaches Claude — guards
// against runaway token cost from oversized payloads.
const MAX_TURN_LENGTH = 10_000;

// Allow time for the streamed Claude response.
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
    return new Response(
      JSON.stringify({ error: "Too many requests. Please slow down." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rl.retryAfter),
        },
      }
    );
  }

  // 1. Load debate
  const { data: dbDebate, error: debateError } = await supabase
    .from("debates")
    .select("*")
    .eq("id", params.debateId)
    .single();

  if (debateError || !dbDebate) {
    return new Response(JSON.stringify({ error: "Debate not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const config = dbDebate.config as DebateConfig;
  const currentStage = dbDebate.current_stage as DebateStage;

  // 2. Load existing turns
  const { data: existingTurns } = await supabase
    .from("debate_turns")
    .select("*")
    .eq("debate_id", params.debateId)
    .order("created_at", { ascending: true });

  const turns = (existingTurns || []) as DebateTurn[];

  // 3. Handle user content if this is a user stage
  let body: { content?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is ok for AI-only stages
  }

  let stageForAi: DebateStage;

  if (isUserStage(currentStage)) {
    if (!body.content) {
      return new Response(JSON.stringify({ error: "Content required for user turn" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (body.content.length > MAX_TURN_LENGTH) {
      return new Response(
        JSON.stringify({
          error: `Turn is too long (max ${MAX_TURN_LENGTH.toLocaleString()} characters)`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Save user turn
    const { error: userTurnError } = await supabase
      .from("debate_turns")
      .insert({
        debate_id: params.debateId,
        stage: currentStage,
        role: "user",
        content: body.content,
      });

    if (userTurnError) {
      return new Response(
        JSON.stringify({ error: "Failed to save your turn" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    turns.push({
      id: "pending",
      debate_id: params.debateId,
      stage: currentStage,
      role: "user",
      content: body.content,
      created_at: new Date().toISOString(),
    });

    // Advance to AI stage
    const nextStage = getNextStage(currentStage, config);
    if (!nextStage || !isAiStage(nextStage)) {
      // No AI response needed, just advance
      const { error: advanceError } = await supabase
        .from("debates")
        .update({ current_stage: nextStage || "complete", updated_at: new Date().toISOString() })
        .eq("id", params.debateId);

      if (advanceError) {
        return new Response(
          JSON.stringify({ error: "Failed to advance debate stage" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ done: true, nextStage: nextStage || "complete" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    stageForAi = nextStage;

    // Update stage to AI stage
    const { error: stageError } = await supabase
      .from("debates")
      .update({ current_stage: stageForAi, updated_at: new Date().toISOString() })
      .eq("id", params.debateId);

    if (stageError) {
      return new Response(
        JSON.stringify({ error: "Failed to advance debate stage" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  } else if (isAiStage(currentStage)) {
    stageForAi = currentStage;
  } else {
    return new Response(JSON.stringify({ error: "Invalid stage for turn submission" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 4. Build prompt and stream AI response
  const persona = await getPersonaBySlug(config.personaId);
  if (!persona) {
    return new Response(JSON.stringify({ error: "Persona not found" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const debate: Debate = {
    id: params.debateId,
    config,
    current_stage: stageForAi,
    turns,
    feedback: null,
    created_at: dbDebate.created_at,
    updated_at: dbDebate.updated_at,
  };

  const systemPrompt = buildSystemPrompt(persona, debate);
  const messages = buildMessages(turns, stageForAi, body.content ? undefined : undefined);

  // Add stage instruction for AI
  const stageInstructions: Partial<Record<DebateStage, string>> = {
    opening_ai: "Deliver your opening statement with 2-4 clear arguments.",
    rebuttal_ai_1: "Provide your rebuttal. Address specific points from the opponent.",
    rebuttal_ai_2: "Provide your second rebuttal. Press harder on weaknesses.",
    cross_exam_ai: "Ask 3-5 pointed cross-examination questions.",
    cross_exam_ai_response: "Comment on the opponent's cross-examination answers.",
    closing_ai: "Deliver your closing statement.",
  };

  const instruction = stageInstructions[stageForAi];
  if (instruction && messages.length > 0) {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === "user") {
      lastMsg.content += `\n\n[Stage direction: ${instruction}]`;
    }
  }

  // Ensure valid message structure
  if (messages.length === 0 || messages[0].role !== "user") {
    messages.unshift({
      role: "user",
      content: `[The debate begins. ${instruction || "Proceed with your turn."}]`,
    });
  }

  const anthropic = getAnthropicClient();

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        let fullText = "";

        const stream = anthropic.messages.stream({
          model: CLAUDE_MODEL,
          max_tokens: 1500,
          system: systemPrompt,
          messages,
        });

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            fullText += event.delta.text;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ text: event.delta.text })}\n\n`
              )
            );
          }
        }

        // Save AI turn
        const { error: aiTurnError } = await supabase
          .from("debate_turns")
          .insert({
            debate_id: params.debateId,
            stage: stageForAi,
            role: "ai",
            content: fullText,
          });

        if (aiTurnError) {
          throw new Error("Failed to save AI turn");
        }

        // Advance to next stage
        const nextStage = getNextStage(stageForAi, config);
        const { error: advanceError } = await supabase
          .from("debates")
          .update({
            current_stage: nextStage || "complete",
            updated_at: new Date().toISOString(),
          })
          .eq("id", params.debateId);

        if (advanceError) {
          throw new Error("Failed to advance debate stage");
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ done: true, nextStage: nextStage || "complete" })}\n\n`
          )
        );
        controller.close();
      } catch (err) {
        reportError(err, {
          route: "debate/turn",
          debateId: params.debateId,
          stage: stageForAi,
        });
        // Send a generic message — never leak internal error detail.
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              error: "The AI response failed. Please try again.",
            })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
