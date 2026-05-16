"use client";

import { useState, useEffect, useCallback } from "react";
import { Debate, DebateFeedback, DebateStage } from "@/lib/debate/types";
import { isUserStage, isAiStage, getStageLabel, getStageInstruction } from "@/lib/debate/state-machine";
import { useStreamingResponse } from "./use-streaming-response";

interface UseDebateReturn {
  debate: Debate | null;
  loading: boolean;
  error: string | null;
  isMyTurn: boolean;
  isAiTurn: boolean;
  streamedText: string;
  isStreaming: boolean;
  stageLabel: string;
  stageInstruction: string;
  submitTurn: (content: string) => Promise<void>;
  triggerAiTurn: () => Promise<void>;
  requestFeedback: () => Promise<void>;
  feedback: DebateFeedback | null;
  feedbackLoading: boolean;
}

export function useDebate(debateId: string): UseDebateReturn {
  const [debate, setDebate] = useState<Debate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<DebateFeedback | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const { streamedText, isStreaming, startStream } = useStreamingResponse();

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

  const currentStage = (debate?.current_stage || "setup") as DebateStage;
  const isMyTurn = isUserStage(currentStage);
  const isAiTurn = isAiStage(currentStage);

  // The streaming `done` event reports the stage the server already
  // persisted. Apply it after fetchDebate() so the UI advances even when the
  // refetch GET returns a stale current_stage.
  const applyNextStage = useCallback((nextStage?: string) => {
    if (!nextStage) return;
    setDebate((prev) =>
      prev ? { ...prev, current_stage: nextStage as DebateStage } : prev
    );
  }, []);

  const submitTurn = useCallback(
    async (content: string) => {
      if (!debate) return;

      const result = await startStream(debateId, content);
      await fetchDebate();
      applyNextStage(result?.nextStage);
    },
    [debate, debateId, startStream, fetchDebate, applyNextStage]
  );

  const triggerAiTurn = useCallback(async () => {
    if (!debate) return;

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

  return {
    debate,
    loading,
    error,
    isMyTurn,
    isAiTurn,
    streamedText,
    isStreaming,
    stageLabel: getStageLabel(currentStage),
    stageInstruction: getStageInstruction(currentStage),
    submitTurn,
    triggerAiTurn,
    requestFeedback,
    feedback,
    feedbackLoading,
  };
}
