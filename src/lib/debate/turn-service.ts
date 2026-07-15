// Shared, transport-agnostic turn logic for HUMAN-mode debates.
//
// The AI turn flow lives in the turn route because it owns an SSE stream and a
// Claude call. Human turns are a plain DB write, so their "check authority →
// insert turn → advance stage" logic lives here where the future timeout route
// (Phase C) can reuse it. Returns a discriminated result the caller maps to an
// HTTP response — this module never touches Request/Response.

import type { SupabaseClient } from "@supabase/supabase-js";
import { DebateConfig, DebateStage } from "./types";
import { getActiveSide, getNextStage } from "./state-machine";

export const MAX_TURN_LENGTH = 10_000;

interface DebateRow {
  id: string;
  config: DebateConfig;
  current_stage: DebateStage;
}

export type HumanTurnResult =
  | { ok: true; nextStage: DebateStage }
  | {
      ok: false;
      status: 400 | 403 | 409 | 500;
      error: string;
      conflict?: boolean;
    };

/**
 * Record one human debater's turn and advance the debate.
 *
 * Server-authoritative turn authority is the core security property: only the
 * participant whose side is active may submit, and the compare-and-set advance
 * (`.eq("current_stage", …)`) guarantees exactly one writer wins a race.
 */
export async function submitHumanTurn(
  supabase: SupabaseClient,
  args: { debate: DebateRow; userId: string; content: string | undefined }
): Promise<HumanTurnResult> {
  const { debate, userId, content } = args;
  const { config } = debate;
  const currentStage = debate.current_stage;

  const activeSide = getActiveSide(currentStage, config);
  if (!activeSide) {
    return { ok: false, status: 400, error: "No turn to submit at this stage" };
  }

  // Which side is THIS user? (Their participant row.)
  const { data: participant } = await supabase
    .from("debate_participants")
    .select("side")
    .eq("debate_id", debate.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!participant) {
    return { ok: false, status: 403, error: "You are not a participant in this debate" };
  }

  if (participant.side !== activeSide) {
    return { ok: false, status: 403, error: "It's not your turn yet." };
  }

  if (!content || !content.trim()) {
    return { ok: false, status: 400, error: "Content required for your turn" };
  }

  if (content.length > MAX_TURN_LENGTH) {
    return {
      ok: false,
      status: 400,
      error: `Turn is too long (max ${MAX_TURN_LENGTH.toLocaleString()} characters)`,
    };
  }

  const nextStage = getNextStage(currentStage, config) || "complete";

  // Optimistic-concurrency advance FIRST. The current_stage guard means only
  // one request can win — the loser's UPDATE hits zero rows and we bail before
  // writing a duplicate turn. (RLS authorizes the non-owner participant via the
  // "Participants advance joined debates" policy from migration 010.)
  const { data: advanced, error: advanceError } = await supabase
    .from("debates")
    .update({
      current_stage: nextStage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", debate.id)
    .eq("current_stage", currentStage)
    .select("id");

  if (advanceError) {
    return { ok: false, status: 500, error: "Failed to advance debate stage" };
  }

  if (!advanced || advanced.length === 0) {
    return {
      ok: false,
      status: 409,
      conflict: true,
      error: "This debate already advanced. Refresh and try again.",
    };
  }

  // We won the race — record the turn (role = the debater's side).
  const { error: turnError } = await supabase.from("debate_turns").insert({
    debate_id: debate.id,
    stage: currentStage,
    role: activeSide,
    content,
    author_id: userId,
  });

  if (turnError) {
    return { ok: false, status: 500, error: "Failed to save your turn" };
  }

  return { ok: true, nextStage };
}
