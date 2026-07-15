"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Debate,
  DebateConfig,
  DebateFeedback,
  DebateParticipant,
  DebateStage,
  DebateTurn,
  Side,
} from "@/lib/debate/types";
import {
  isUserStage,
  isAiStage,
  getActiveSide,
  getStageLabel,
  getStageInstruction,
} from "@/lib/debate/state-machine";
import { useStreamingResponse } from "./use-streaming-response";
import { useRealtimeDebate } from "./use-realtime-debate";

interface UseDebateReturn {
  debate: Debate | null;
  loading: boolean;
  error: string | null;
  isMyTurn: boolean;
  isAiTurn: boolean;
  streamedText: string;
  isStreaming: boolean;
  streamError: string | null;
  clearStreamError: () => void;
  stageLabel: string;
  stageInstruction: string;
  submitTurn: (content: string) => Promise<void>;
  triggerAiTurn: () => Promise<void>;
  requestFeedback: () => Promise<void>;
  feedback: DebateFeedback | null;
  feedbackLoading: boolean;
  // Human-vs-human extras (all inert / defaults in AI mode).
  isHuman: boolean;
  waitingForOpponent: boolean;
  inviteToken: string | null;
  viewerSide: Side | null;
  opponent: DebateParticipant | null;
  refresh: () => Promise<void>;
  // Realtime (Phase B) — all inert in AI mode.
  realtimeConnected: boolean;
  onlineSides: Side[];
  opponentTyping: boolean;
  broadcastTyping: () => void;
}

export function useDebate(debateId: string): UseDebateReturn {
  const [debate, setDebate] = useState<Debate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<DebateFeedback | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { streamedText, isStreaming, streamError, startStream, clearStreamError } =
    useStreamingResponse();

  const fetchDebate = useCallback(async () => {
    try {
      const res = await fetch(`/api/debate/${debateId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch debate");
      const data = await res.json();
      setDebate(data);
      if (data.feedback) setFeedback(data.feedback);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [debateId]);

  useEffect(() => {
    fetchDebate();
  }, [fetchDebate]);

  const config = (debate?.config ?? null) as DebateConfig | null;
  const isHuman = config?.mode === "human";
  const currentStage = (debate?.current_stage || "setup") as DebateStage;

  const participants = debate?.participants ?? [];
  const viewerSide = debate?.viewerSide ?? null;
  const waitingForOpponent = !!isHuman && participants.length < 2;
  const opponent =
    (isHuman && participants.find((p) => p.side !== viewerSide)) || null;

  // "My turn": AI mode keys off the user-stage classification; human mode
  // compares the active side to the viewer's own side (and only once both
  // players are present).
  const isMyTurn = isHuman
    ? !waitingForOpponent &&
      viewerSide != null &&
      config != null &&
      getActiveSide(currentStage, config) === viewerSide
    : isUserStage(currentStage);

  // The AI never acts in human mode.
  const isAiTurn = !isHuman && isAiStage(currentStage);

  // The streaming `done` event reports the stage the server already
  // persisted. Apply it after fetchDebate() so the UI advances even when the
  // refetch GET returns a stale current_stage.
  const applyNextStage = useCallback((nextStage?: string) => {
    if (!nextStage) return;
    setDebate((prev) =>
      prev ? { ...prev, current_stage: nextStage as DebateStage } : prev
    );
  }, []);

  // --- Realtime (Phase B): live turns, stage sync, presence, typing ---
  const viewerId =
    (isHuman && participants.find((p) => p.side === viewerSide)?.user_id) ||
    null;

  const handleTurnInsert = useCallback((turn: DebateTurn) => {
    setDebate((prev) => {
      if (!prev) return prev;
      if (prev.turns.some((t) => t.id === turn.id)) return prev;
      return { ...prev, turns: [...prev.turns, turn] };
    });
  }, []);

  const handleStageChange = useCallback((stage: string) => {
    setDebate((prev) =>
      prev ? { ...prev, current_stage: stage as DebateStage } : prev
    );
  }, []);

  const {
    connected: realtimeConnected,
    onlineSides,
    typingSide,
    broadcastTyping,
  } = useRealtimeDebate({
    debateId,
    enabled: !!isHuman,
    viewerId,
    viewerSide,
    onTurnInsert: handleTurnInsert,
    onStageChange: handleStageChange,
  });

  // The opponent joining fires a presence sync before any turn/stage event; the
  // moment their side comes online while we're still waiting, refetch to pick
  // up the roster and open the debate.
  useEffect(() => {
    if (!isHuman || !waitingForOpponent || !viewerSide) return;
    const opponentSide: Side = viewerSide === "pro" ? "con" : "pro";
    if (onlineSides.includes(opponentSide)) {
      fetchDebate();
    }
  }, [isHuman, waitingForOpponent, viewerSide, onlineSides, fetchDebate]);

  const opponentTyping = typingSide != null && typingSide !== viewerSide;

  const submitTurn = useCallback(
    async (content: string) => {
      if (!debate) return;
      setActionError(null);

      // Human mode: plain JSON POST, no SSE, no Claude. Refetch to pick up the
      // opponent's turns and the advanced stage.
      if (debate.config?.mode === "human") {
        try {
          const res = await fetch(`/api/debate/${debateId}/turn`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setActionError(data.error || "Failed to submit your turn");
            return;
          }
          await fetchDebate();
          applyNextStage(data?.nextStage);
        } catch {
          setActionError("Failed to submit your turn");
        }
        return;
      }

      const result = await startStream(debateId, content);
      await fetchDebate();
      applyNextStage(result?.nextStage);
    },
    [debate, debateId, startStream, fetchDebate, applyNextStage]
  );

  const triggerAiTurn = useCallback(async () => {
    if (!debate || debate.config?.mode === "human") return;

    const result = await startStream(debateId);
    await fetchDebate();
    applyNextStage(result?.nextStage);
  }, [debate, debateId, startStream, fetchDebate, applyNextStage]);

  const requestFeedback = useCallback(async () => {
    setFeedbackLoading(true);
    try {
      const res = await fetch(`/api/debate/${debateId}/feedback`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to get feedback");
      const data = await res.json();
      setFeedback(data.feedback);
      await fetchDebate();
      // The feedback route ends the debate; advance the UI even if the
      // refetch is stale.
      applyNextStage("complete");
    } catch (err) {
      console.error("Feedback error:", err);
    } finally {
      setFeedbackLoading(false);
    }
  }, [debateId, fetchDebate, applyNextStage]);

  const clearErrors = useCallback(() => {
    clearStreamError();
    setActionError(null);
  }, [clearStreamError]);

  return {
    debate,
    loading,
    error,
    isMyTurn,
    isAiTurn,
    streamedText,
    isStreaming,
    streamError: streamError ?? actionError,
    clearStreamError: clearErrors,
    stageLabel: getStageLabel(currentStage),
    stageInstruction: getStageInstruction(currentStage),
    submitTurn,
    triggerAiTurn,
    requestFeedback,
    feedback,
    feedbackLoading,
    isHuman: !!isHuman,
    waitingForOpponent,
    inviteToken: debate?.invite_token ?? null,
    viewerSide,
    opponent,
    refresh: fetchDebate,
    realtimeConnected,
    onlineSides,
    opponentTyping,
    broadcastTyping,
  };
}
