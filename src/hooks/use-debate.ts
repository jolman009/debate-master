"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Debate,
  DebateConfig,
  DebateFeedback,
  DebateParticipant,
  DebateStage,
  DebateTurn,
  JudgeResult,
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
import type { DebateRowPatch } from "@/lib/supabase/realtime";

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
  // The two-sided judge verdict (Phase D). Human mode only.
  judgeResult: JudgeResult | null;
  // The viewer's Elo change from this debate, once judged.
  ratingDelta: number | null;
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

  // A live `debates` UPDATE carries the whole row, so this syncs the stage AND
  // delivers the judge's verdict to the player who didn't request it.
  const handleDebateUpdate = useCallback(
    (patch: DebateRowPatch) => {
      setDebate((prev) => {
        if (!prev) return prev;
        const next = { ...prev };
        if (patch.current_stage) {
          next.current_stage = patch.current_stage as DebateStage;
        }
        if (patch.judge_result !== undefined) {
          next.judge_result = patch.judge_result;
        }
        return next;
      });
      // The verdict also stamps per-participant Elo deltas, which live on
      // debate_participants and don't come over this channel — refetch so the
      // player who didn't request the verdict still sees their rating change.
      if (patch.judge_result) fetchDebate();
    },
    [fetchDebate]
  );

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
    onDebateUpdate: handleDebateUpdate,
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

  // AI mode: one-sided coach feedback. Human mode: the two-sided judge verdict
  // (same endpoint, branched server-side). Either player may request the
  // verdict; the server refuses to judge the same debate twice.
  const requestFeedback = useCallback(async () => {
    setFeedbackLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/debate/${debateId}/feedback`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setActionError(data.error || "Failed to get the result");
        return;
      }

      if (data.judgeResult) {
        setDebate((prev) =>
          prev
            ? { ...prev, judge_result: data.judgeResult, current_stage: "complete" }
            : prev
        );
      } else if (data.feedback) {
        setFeedback(data.feedback);
      }

      await fetchDebate();
      // The route ends the debate; advance the UI even if the refetch is stale.
      applyNextStage("complete");
    } catch {
      setActionError("Failed to get the result");
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
    judgeResult: debate?.judge_result ?? null,
    ratingDelta:
      participants.find((p) => p.side === viewerSide)?.rating_delta ?? null,
  };
}
