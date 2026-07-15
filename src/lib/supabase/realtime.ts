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
import { DebateTurn, Side } from "@/lib/debate/types";

export interface DebatePresence {
  userId: string;
  side: Side | null;
}

export interface DebateChannelHandlers {
  onTurnInsert: (turn: DebateTurn) => void;
  onStageChange: (stage: string) => void;
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
      (payload) => {
        const stage = (payload.new as { current_stage?: string }).current_stage;
        if (stage) handlers.onStageChange(stage);
      }
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

  channel.subscribe((status) => {
    const connected = status === "SUBSCRIBED";
    handlers.onStatus(connected);
    if (connected) {
      // Announce our presence once the channel is live.
      void channel.track(me);
    }
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
      void supabase.removeChannel(channel);
    },
  };
}
