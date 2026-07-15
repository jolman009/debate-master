"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DebateTurn, Side } from "@/lib/debate/types";
import { subscribeToDebate } from "@/lib/supabase/realtime";

interface UseRealtimeDebateArgs {
  debateId: string;
  // Only human debates subscribe; AI debates pass enabled=false (no-op).
  enabled: boolean;
  viewerId: string | null;
  viewerSide: Side | null;
  onTurnInsert: (turn: DebateTurn) => void;
  onStageChange: (stage: string) => void;
}

interface UseRealtimeDebateReturn {
  connected: boolean;
  onlineSides: Side[];
  // The opponent's side while they are typing, else null.
  typingSide: Side | null;
  broadcastTyping: () => void;
}

const TYPING_CLEAR_MS = 3000;
const TYPING_THROTTLE_MS = 1500;

export function useRealtimeDebate({
  debateId,
  enabled,
  viewerId,
  viewerSide,
  onTurnInsert,
  onStageChange,
}: UseRealtimeDebateArgs): UseRealtimeDebateReturn {
  const [connected, setConnected] = useState(false);
  const [onlineSides, setOnlineSides] = useState<Side[]>([]);
  const [typingSide, setTypingSide] = useState<Side | null>(null);

  // Keep the latest callbacks without forcing a resubscribe on every render.
  const cbs = useRef({ onTurnInsert, onStageChange });
  cbs.current = { onTurnInsert, onStageChange };

  const typingTimer = useRef<ReturnType<typeof setTimeout>>();
  const broadcastRef = useRef<() => void>(() => {});
  const lastBroadcast = useRef(0);

  useEffect(() => {
    if (!enabled || !debateId || !viewerId) return;

    const handle = subscribeToDebate(
      debateId,
      { userId: viewerId, side: viewerSide },
      {
        onTurnInsert: (t) => cbs.current.onTurnInsert(t),
        onStageChange: (s) => cbs.current.onStageChange(s),
        onPresenceSync: (sides) => setOnlineSides(sides),
        onTyping: (side) => {
          // Broadcast doesn't echo to the sender, but guard anyway so we only
          // ever surface the OPPONENT typing.
          if (side === viewerSide) return;
          setTypingSide(side);
          clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(
            () => setTypingSide(null),
            TYPING_CLEAR_MS
          );
        },
        onStatus: setConnected,
      }
    );

    broadcastRef.current = handle.broadcastTyping;

    return () => {
      clearTimeout(typingTimer.current);
      handle.teardown();
      setConnected(false);
      setOnlineSides([]);
      setTypingSide(null);
      broadcastRef.current = () => {};
    };
  }, [enabled, debateId, viewerId, viewerSide]);

  // Throttle outbound typing so a fast typist emits at most one event / 1.5s.
  const broadcastTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastBroadcast.current < TYPING_THROTTLE_MS) return;
    lastBroadcast.current = now;
    broadcastRef.current();
  }, []);

  return { connected, onlineSides, typingSide, broadcastTyping };
}
