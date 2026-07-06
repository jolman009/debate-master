import { createServerClient } from "@/lib/supabase/server";
import { getAnthropicClient, CLAUDE_MODEL } from "@/lib/anthropic";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { reportError } from "@/lib/observability";
import { getPersonaBySlug } from "@/lib/debate/content";
import { buildSystemPrompt, buildMessages } from "@/lib/debate/prompt-builder";
import { getNextStage, isUserStage, isAiStage } from "@/lib/debate/state-machine";
import { Debate, DebateConfig, DebateStage, DebateTurn } from "@/lib/debate/types";

// Cap user-submitted turn length before it ever reaches Claude - guards
// against runaway token cost from oversized payloads.
const MAX_TURN_LENGTH = 10_000;

// Allow time for the streamed Claude response.
export const maxDuration = 60;

const JSON_HEADERS = { "Content-Type": "application/json" };

function conflict(msg: string) {
  return new Response(JSON.stringify({ error: msg, conflict: true }), {
    status: 409,
    headers: JSON_HEADERS,
  });
}

// True when an error came from an aborted fetch/stream, i.e. the client
// disconnected mid-response. We treat this as "not an error" - no report,
// no user-facing message, no DB writes.
function isAbort(err: unknown, signal: AbortSignal): boolean {
  if (signal.aborted) return true;
  const name = (err as { name?: string } | null)?.name;
  return name === "AbortError" || name === "APIUserAbortError";
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
    return new Response(
      JSON.stringify({ error: "Too many requests. Please slow down." }),
      {
        status: 429,
        headers: {
          ...JSON_HEADERS,
          "Retry-After": String(rl.retryAfter),
        },
      }
    );
  }

  if (!user) {
    return new Response(
      JSON.stringify({ error: "You must be signed in to submit a turn" }),
      { status: 401, headers: JSON_HEADERS }
    );
  }

  // 1. Load debate - the `user_id` filter enforces ownership. A non-owner
  // (or a bad UUID) sees a 404 rather than confirming the debate exists.
  const { data: dbDebate, error: debateError } = await supabase
    .from("debates")
    .select("*")
    .eq("id", params.debateId)
    .eq("user_id", user.id)
    .single();

  if (debateError || !dbDebate) {
    return new Response(JSON.stringify({ error: "Debate not found" }), {
      status: 404,
      headers: JSON_HEADERS,
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
        headers: JSON_HEADERS,
      });
    }

    if (body.content.length > MAX_TURN_LENGTH) {
      return new Response(
        JSON.stringify({
          error: `Turn is too long (max ${MAX_TURN_LENGTH.toLocaleString()} characters)`,
        }),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    // Decide the next stage now so the atomic advance below can use it.
    const nextStage = getNextStage(currentStage, config);
    const goesToAi = !!nextStage && isAiStage(nextStage);
    const nextStageForDb = goesToAi ? nextStage : (nextStage || "complete");

    // Optimistic-concurrency advance FIRST. The `.eq("current_stage",
    // currentStage)` guard means only one concurrent request can win the
    // race - the loser's UPDATE affects zero rows and we bail before
    // writing a duplicate user turn or starting a second AI stream.
    const { data: advanced, error: advanceError } = await supabase
      .from("debates")
      .update({
        current_stage: nextStageForDb,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.debateId)
      .eq("user_id", user.id)
      .eq("current_stage", currentStage)
      .select("id");

    if (advanceError) {
      return new Response(
        JSON.stringify({ error: "Failed to advance debate stage" }),
        { status: 500, headers: JSON_HEADERS }
      );
    }

    if (!advanced || advanced.length === 0) {
      return conflict(
        "This debate already advanced. Refresh and try again."
      );
    }

    // We won the race - now safely record the user turn.
    const { error: userTurnError } = await supabase
      .from("debate_turns")
      .insert({
        debate_id: params.debateId,
        stage: currentStage,
        role: "user",
        content: body.content,
      });

    if (userTurnError) {
      // Rare: stage advanced but the turn insert failed. Report so we
      // can spot it; the debate is in a mildly odd state (advanced with
      // no user turn recorded for this stage).
      reportError(userTurnError, {
        route: "debate/turn",
        debateId: params.debateId,
        stage: currentStage,
        phase: "user-turn-insert",
      });
      return new Response(
        JSON.stringify({ error: "Failed to save your turn" }),
        { status: 500, headers: JSON_HEADERS }
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

    if (!goesToAi) {
      // No AI response needed - we already advanced above.
      return new Response(
        JSON.stringify({ done: true, nextStage: nextStageForDb }),
        { headers: JSON_HEADERS }
      );
    }

    stageForAi = nextStage!;
  } else if (isAiStage(currentStage)) {
    stageForAi = currentStage;
  } else {
    return new Response(JSON.stringify({ error: "Invalid stage for turn submission" }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  // 4. Build prompt and stream AI response
  const persona = await getPersonaBySlug(config.personaId);
  if (!persona) {
    return new Response(JSON.stringify({ error: "Persona not found" }), {
      status: 400,
      headers: JSON_HEADERS,
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
  // `userContent` is intentionally undefined - the user's turn was already
  // appended to `turns` above, so passing it again would duplicate it.
  // `buildMessages` owns the AI stage instruction and the "first message must
  // be user" invariant, so don't re-do that work here.
  const messages = buildMessages(turns, stageForAi, undefined);

  const anthropic = getAnthropicClient();

  const encoder = new TextEncoder();
  const signal = request.signal;
  const readable = new ReadableStream({
    async start(controller) {
      try {
        let fullText = "";

        // Wiring `signal` into the SDK call means a client disconnect (or
        // an unmounted React component that fires its AbortController)
        // aborts the upstream Anthropic fetch too - we stop paying for
        // tokens the moment nobody is listening.
        const stream = anthropic.messages.stream(
          {
            model: CLAUDE_MODEL,
            max_tokens: 1500,
            system: systemPrompt,
            messages,
          },
          { signal }
        );

        for await (const event of stream) {
          if (signal.aborted) break;
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

        // If the client is gone, do not touch the DB - a partial AI turn
        // and an advanced stage would leave the debate in a broken state
        // that the user would then have to reconcile on refresh.
        if (signal.aborted) {
          controller.close();
          return;
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

        // Advance to next stage with the same optimistic guard. If another
        // request already advanced past `stageForAi` (e.g. a client retry
        // that also produced an AI response), our UPDATE affects zero rows
        // and we treat it as a conflict.
        const nextStage = getNextStage(stageForAi, config);
        const { data: advanced, error: advanceError } = await supabase
          .from("debates")
          .update({
            current_stage: nextStage || "complete",
            updated_at: new Date().toISOString(),
          })
          .eq("id", params.debateId)
          .eq("user_id", user.id)
          .eq("current_stage", stageForAi)
          .select("id");

        if (advanceError) {
          throw new Error("Failed to advance debate stage");
        }

        if (!advanced || advanced.length === 0) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                error: "This debate already advanced. Refresh and try again.",
                conflict: true,
              })}\n\n`
            )
          );
          controller.close();
          return;
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ done: true, nextStage: nextStage || "complete" })}\n\n`
          )
        );
        controller.close();
      } catch (err) {
        // Client disconnect / component unmount - silent close, no report.
        if (isAbort(err, signal)) {
          try {
            controller.close();
          } catch {
            // Already closed.
          }
          return;
        }

        reportError(err, {
          route: "debate/turn",
          debateId: params.debateId,
          stage: stageForAi,
        });
        // Send a generic message - never leak internal error detail.
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                error: "The AI response failed. Please try again.",
              })}\n\n`
            )
          );
          controller.close();
        } catch {
          // Downstream reader is already gone.
        }
      }
    },
    cancel() {
      // ReadableStream was cancelled from the consumer side. The
      // `signal.aborted` check inside `start()` covers this; nothing
      // else to do here beyond noting we saw the cancellation.
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
