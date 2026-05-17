"use client";

import { useEffect, useRef, useState } from "react";
import { useDebate } from "@/hooks/use-debate";
import { getPersona } from "@/lib/debate/personas";
import { DebateConfig, DebateStage as DebateStageType, PersonaId, VoiceConfig } from "@/lib/debate/types";
import { StageIndicator } from "./stage-indicator";
import { LiveStage } from "./live-stage";
import { TurnDisplay } from "./turn-display";
import { AiStreamingTurn } from "./ai-streaming-turn";
import { UserInput } from "./user-input";
import { FeedbackPanel } from "./feedback-panel";
import { SpeechToggle } from "./speech-toggle";
import { TranscriptOverlay } from "./transcript-overlay";
import { Button } from "@/components/ui/button";
import { useSpeech } from "@/hooks/use-speech";

interface DebateStageProps {
  debateId: string;
}

export function DebateStage({ debateId }: DebateStageProps) {
  const {
    debate,
    loading,
    error,
    isMyTurn,
    isAiTurn,
    streamedText,
    isStreaming,
    streamError,
    clearStreamError,
    stageLabel,
    stageInstruction,
    submitTurn,
    triggerAiTurn,
    requestFeedback,
    feedback,
    feedbackLoading,
  } = useDebate(debateId);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [showTranscript, setShowTranscript] = useState(false);

  const config = debate ? (debate.config as DebateConfig) : null;
  const persona = config ? getPersona(config.personaId as PersonaId) : null;
  const defaultVoice: VoiceConfig = { pitch: 1, rate: 1, voicePrefs: [] };

  const { isMuted, toggleMute, isSupported, isSpeaking, amplitude } = useSpeech(
    streamedText,
    isStreaming,
    persona?.voiceConfig ?? defaultVoice
  );

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [debate?.turns, streamedText]);

  // Auto-trigger AI turns. The `!streamError` guard stops a failed AI turn
  // from re-firing in a loop — recovery is via the manual Retry button.
  useEffect(() => {
    if (isAiTurn && !isStreaming && debate && !streamError) {
      triggerAiTurn();
    }
  }, [isAiTurn, isStreaming, debate?.current_stage, streamError]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-stage-muted">Loading debate...</div>
      </div>
    );
  }

  if (error || !debate) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-stage-con">
          {error || "Debate not found"}
        </div>
      </div>
    );
  }

  const currentStage = debate.current_stage as DebateStageType;
  const isFeedbackStage = currentStage === "feedback";
  const isComplete = currentStage === "complete";

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col h-[calc(100vh-73px)]">
      {/* Header */}
      <div className="space-y-4 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="text-xs text-stage-muted">
            <p className="uppercase tracking-wider mb-0.5">Topic</p>
            <p className="text-sm font-medium text-stage-text">{config!.topic}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTranscript(true)}
              title="View full transcript"
              className="gap-1.5"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              <span className="hidden sm:inline">Transcript</span>
            </Button>
            <SpeechToggle
              isMuted={isMuted}
              onToggle={toggleMute}
              isSupported={isSupported}
            />
          </div>
        </div>

        <LiveStage
          persona={persona!}
          userSide={config!.userSide}
          isStreaming={isStreaming}
          isSpeaking={isSpeaking}
          isAiTurn={isAiTurn}
          isMyTurn={isMyTurn}
          amplitude={amplitude}
        />

        <StageIndicator config={config!} currentStage={currentStage} />

        {/* Stage banner */}
        {!isComplete && (
          <div className="debate-card py-3 px-4 text-center">
            <p className="text-sm font-semibold text-stage-accent">
              {stageLabel}
            </p>
            {stageInstruction && (
              <p className="text-xs text-stage-muted mt-1">
                {stageInstruction}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Turns */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto py-4 space-y-4 min-h-0"
      >
        {debate.turns.map((turn) => (
          <TurnDisplay
            key={turn.id}
            turn={turn}
            personaName={persona!.displayName}
          />
        ))}

        {streamedText && !(debate.turns.some(t => t.role === "ai" && t.content === streamedText)) && (
          <AiStreamingTurn
            text={streamedText}
            personaName={persona!.displayName}
            stageLabel={stageLabel}
          />
        )}

        {isAiTurn && !isStreaming && !streamedText && (
          <div className="flex items-center gap-2 text-sm text-stage-muted">
            <span className="inline-block w-2 h-2 rounded-full bg-stage-accent animate-pulse" />
            {persona!.displayName} is thinking...
          </div>
        )}
      </div>

      {/* Input / Feedback */}
      <div className="shrink-0 pt-4 border-t border-stage-border">
        {streamError && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-stage-con/40 bg-stage-con/10 px-3 py-2">
            <p className="text-sm text-stage-con">{streamError}</p>
            <div className="flex shrink-0 items-center gap-3">
              {isAiTurn && (
                <button
                  type="button"
                  onClick={() => triggerAiTurn()}
                  className="text-sm font-medium text-stage-accent hover:underline"
                >
                  Retry
                </button>
              )}
              <button
                type="button"
                onClick={clearStreamError}
                className="text-sm text-stage-muted hover:text-stage-text"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        {isFeedbackStage && !feedback && (
          <div className="text-center py-4">
            <p className="text-stage-muted text-sm mb-3">
              The debate is over! Get AI feedback on your performance.
            </p>
            <Button onClick={requestFeedback} disabled={feedbackLoading}>
              {feedbackLoading ? "Generating Feedback..." : "Get Feedback"}
            </Button>
          </div>
        )}

        {feedback && <FeedbackPanel feedback={feedback} />}

        {isComplete && !feedback && (
          <div className="text-center py-4">
            <p className="text-stage-muted text-sm">Debate complete!</p>
          </div>
        )}

        {isMyTurn && !isStreaming && (
          <UserInput
            onSubmit={submitTurn}
            disabled={isStreaming}
            placeholder={stageInstruction || "Enter your argument..."}
          />
        )}

        {isAiTurn && (
          <div className="text-center py-2">
            <p className="text-xs text-stage-muted">
              Waiting for {persona!.displayName} to respond...
            </p>
          </div>
        )}
      </div>

      <TranscriptOverlay
        open={showTranscript}
        onClose={() => setShowTranscript(false)}
        turns={debate.turns}
        personaName={persona!.displayName}
      />
    </div>
  );
}
