// Browser-side Supabase Realtime wiring for a single human debate.
//
// Subscribes over the authenticated browser client (so RLS + the user's JWT
// apply — only the debate's two participants receive events). One channel per
// debate carries three signals:
//   - postgres_changes: new turns (INSERT) and stage advances (UPDATE debates)
//   - presence: who is currently connected, and on which side (live vs async)
//   - broadcast "typing": the opponent-is-typing indicator
//
// Vercel's serverless functions can't hold a socket, so this runs in the
// browser and bypasses the API layer for the live channel.

import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseClient } from "./client";
import { DebateTurn, JudgeResult, Side } from "@/lib/debate/types";

export interface DebatePresence {
  userId: string;
  side: Side | null;
}

/**
 * The fields we consume from a live `debates` UPDATE. REPLICA IDENTITY FULL
 * (migration 011) means the payload carries the whole row, so the judge's
 * verdict reaches BOTH players — not just the one who requested it.
 */
export interface DebateRowPatch {
  current_stage?: string;
  judge_result?: JudgeResult | null;
}

export interface DebateChannelHandlers {
  onTurnInsert: (turn: DebateTurn) => void;
  onDebateUpdate: (patch: DebateRowPatch) => void;
  onPresenceSync: (onlineSides: Side[]) => void;
  onTyping: (side: Side) => void;
  onStatus: (connected: boolean) => void;
}

export interface DebateChannelHandle {
  broadcastTyping: () => void;
  teardown: () => void;
}

export function subscribeToDebate(
  debateId: string,
  me: DebatePresence,
  handlers: DebateChannelHandlers
): DebateChannelHandle {
  const supabase = getSupabaseClient();
  const channel = supabase.channel(`debate:${debateId}`, {
    config: { presence: { key: me.userId } },
  });

  channel
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "debate_turns",
        filter: `debate_id=eq.${debateId}`,
      },
      (payload) => handlers.onTurnInsert(payload.new as DebateTurn)
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "debates",
        filter: `id=eq.${debateId}`,
      },
      (payload) => handlers.onDebateUpdate(payload.new as DebateRowPatch)
    )
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as Record<
        string,
        DebatePresence[]
      >;
      const sides = new Set<Side>();
      for (const entries of Object.values(state)) {
        for (const p of entries) {
          if (p.side === "pro" || p.side === "con") sides.add(p.side);
        }
      }
      handlers.onPresenceSync([...sides]);
    })
    .on("broadcast", { event: "typing" }, ({ payload }) => {
      const side = (payload as { side?: Side }).side;
      if (side === "pro" || side === "con") handlers.onTyping(side);
    });

  // postgres_changes are RLS-filtered against the subscriber's JWT: without an
  // authenticated token the participant SELECT policies match nothing and NO
  // row events arrive (presence/broadcast still work — they're token-agnostic).
  // A freshly-created browser client hasn't pushed its token to the realtime
  // socket yet, so set it explicitly BEFORE subscribing.
  let cancelled = false;
  void supabase.auth.getSession().then(({ data }) => {
    if (cancelled) return;
    const token = data.session?.access_token;
    if (token) supabase.realtime.setAuth(token);
    channel.subscribe((status) => {
      const connected = status === "SUBSCRIBED";
      handlers.onStatus(connected);
      if (connected) {
        // Announce our presence once the channel is live.
        void channel.track(me);
      }
    });
  });

  return {
    broadcastTyping: () => {
      void channel.send({
        type: "broadcast",
        event: "typing",
        payload: { side: me.side },
      });
    },
    teardown: () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    },
  };
}
