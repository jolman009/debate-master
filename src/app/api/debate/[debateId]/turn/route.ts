import { createServiceClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import {
  getGeminiClient,
  GEMINI_FALLBACK_MODELS,
  isRetryableGeminiError,
} from "@/lib/gemini";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { reportError } from "@/lib/observability";
import { getPersonaBySlug } from "@/lib/debate/content";
import { buildSystemPrompt, buildMessages } from "@/lib/debate/prompt-builder";
import { getNextStage, isUserStage, isAiStage } from "@/lib/debate/state-machine";
import { submitHumanTurn } from "@/lib/debate/turn-service";
import { Debate, DebateConfig, DebateStage, DebateTurn } from "@/lib/debate/types";

// Cap user-submitted turn length before it ever reaches Gemini - guards
// against runaway token cost from oversized payloads.
const MAX_TURN_LENGTH = 10_000;

// Allow time for the streamed Gemini response.
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

  // 1. Load debate. RLS scopes visibility: an AI debate is owner-only (no
  // participant rows), while a human debate is readable by both participants.
  // A non-authorized user (or bad UUID) sees a 404 rather than a confirmation
  // that the debate exists.
  const { data: dbDebate, error: debateError } = await supabase
    .from("debates")
    .select("*")
    .eq("id", params.debateId)
    .single();

  if (debateError || !dbDebate) {
    return new Response(JSON.stringify({ error: "Debate not found" }), {
      status: 404,
      headers: JSON_HEADERS,
    });
  }

  const config = dbDebate.config as DebateConfig;
  const currentStage = dbDebate.current_stage as DebateStage;

  // Human mode: no Gemini call, no SSE. Turn authority + insert + advance are
  // handled server-side, returning plain JSON.
  if (config.mode === "human") {
    let humanBody: { content?: string } = {};
    try {
      humanBody = await request.json();
    } catch {
      // Missing/invalid body handled as "content required" below.
    }

    const result = await submitHumanTurn(supabase, {
      debate: { id: dbDebate.id, config, current_stage: currentStage },
      userId: user.id,
      content: humanBody.content,
    });

    if (!result.ok) {
      if (result.status === 500) {
        reportError(new Error(result.error), {
          route: "debate/turn",
          debateId: params.debateId,
          stage: currentStage,
          mode: "human",
        });
      }
      return new Response(
        JSON.stringify(
          result.conflict
            ? { error: result.error, conflict: true }
            : { error: result.error }
        ),
        { status: result.status, headers: JSON_HEADERS }
      );
    }

    return new Response(
      JSON.stringify({ done: true, nextStage: result.nextStage }),
      { headers: JSON_HEADERS }
    );
  }

  // AI mode below — the original single-request "save user turn + stream AI
  // reply" flow.

  const writer = createServiceClient();

  // 2. Load existing turns
  const { data: existingTurns } = await supabase
    .from("debate_turns")
    .select("*")
    .eq("debate_id", params.debateId)
    .order("created_at", { ascending: true });

  const turns = (existingTurns || []) as DebateTurn[];

  // 3. Handle user content if this is a user stage
  let body: { content?: string; expectedStage?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is ok for AI-only stages
  }

  // A retry from a stale tab must not generate a different stage under the old
  // client label, or submit an old answer into a later user stage. Older clients
  // without this field retain compatibility; database fencing still applies.
  if (body.expectedStage !== undefined && body.expectedStage !== currentStage) {
    return conflict("This debate already advanced. Refresh and try again.");
  }

  let stageForAi: DebateStage;

  if (isUserStage(currentStage)) {
    if (typeof body.content !== "string" || !body.content.trim()) {
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

    // Turn insertion and stage advancement share one database transaction.
    const { data: committed, error: commitError } = await writer.rpc("commit_ai_debate_turn", {
      p_user_id: user.id, p_debate_id: params.debateId, p_stage: currentStage,
      p_next_stage: nextStageForDb, p_role: "user", p_content: body.content,
    });
    if (commitError) return new Response(JSON.stringify({ error: "Failed to save your turn" }), {
      status: 500, headers: JSON_HEADERS,
    });
    if (!committed) return conflict("This debate already advanced. Refresh and try again.");

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

  const { data: leaseToken, error: leaseError } = await writer.rpc("claim_ai_debate_turn", {
    p_user_id: user.id, p_debate_id: params.debateId, p_stage: stageForAi,
  });
  if (leaseError) return new Response(JSON.stringify({ error: "Could not start AI response" }), {
    status: 500, headers: JSON_HEADERS,
  });
  if (!leaseToken) return conflict("An AI response is already running or this debate advanced. Refresh before retrying.");

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

  const encoder = new TextEncoder();
  const signal = request.signal;
  let cancelled = false;
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const gemini = getGeminiClient();
        let fullText = "";
        let finishReason: string | undefined;
        let selectedModel: string | undefined;
        const startedAt = Date.now();

        const candidateModels = GEMINI_FALLBACK_MODELS;

        let stream = null;
        let lastErr = null;

        for (const model of candidateModels) {
          try {
            stream = await gemini.models.generateContentStream({
              model,
              contents: messages,
              config: {
                systemInstruction: systemPrompt,
                abortSignal: signal,
                httpOptions: { timeout: 45000 },
                maxOutputTokens: 2000,
                thinkingConfig: {
                  thinkingBudget: 0,
                },
              },
            });
            selectedModel = model;
            break;
          } catch (err: unknown) {
            lastErr = err;
            if (isRetryableGeminiError(err)) {
              continue;
            }
            throw err;
          }
        }

        if (!stream) {
          throw lastErr || new Error("Failed to start AI stream");
        }

        for await (const chunk of stream) {
          if (signal.aborted || cancelled) break;
          finishReason = chunk.candidates?.[0]?.finishReason ?? finishReason;
          const text = chunk.text;
          if (text) {
            fullText += text;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ text })}\n\n`
              )
            );
          }
        }

        // If the client is gone, do not touch the DB - a partial AI turn
        // and an advanced stage would leave the debate in a broken state
        // that the user would then have to reconcile on refresh.
        if (signal.aborted || cancelled) {
          controller.close();
          return;
        }

        // Persist only a complete provider response. Truncated or empty output
        // leaves the stage unchanged and can be explicitly retried.
        if (!fullText.trim() || finishReason !== "STOP") {
          reportError(new Error("AI stream did not complete"), {
            route: "debate/turn", debateId: params.debateId, stage: stageForAi,
            model: selectedModel, finishReason: finishReason ?? "missing", latencyMs: Date.now() - startedAt,
          });
          throw new Error("Incomplete AI response");
        }
        const nextStage = getNextStage(stageForAi, config);
        const { data: committed, error: commitError } = await writer.rpc("commit_ai_debate_turn", {
          p_user_id: user.id, p_debate_id: params.debateId, p_stage: stageForAi,
          p_next_stage: nextStage || "complete", p_role: "ai", p_content: fullText, p_token: leaseToken,
        });
        if (commitError) throw new Error("Failed to save AI turn");
        if (!committed) throw new Error("AI turn lease expired or debate advanced");

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ done: true, nextStage: nextStage || "complete" })}\n\n`
          )
        );
        controller.close();
      } catch (err) {
        // Client disconnect / component unmount - silent close, no report.
        if (cancelled || isAbort(err, signal)) {
          try {
            controller.close();
          } catch {
            // Already closed.
          }
          return;
        }

        reportError(new Error("AI turn generation or persistence failed"), {
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
      } finally {
        const { error } = await writer.rpc("release_ai_debate_turn", {
          p_user_id: user.id, p_debate_id: params.debateId, p_token: leaseToken,
        });
        if (error) reportError(new Error("AI lease release failed"), { route: "debate/turn" });
      }
    },
    cancel() {
      cancelled = true;
      // The stream loop stops before persisting and releases its lease.
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
