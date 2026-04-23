"use client";

import { useEffect, useRef } from "react";
import { useDebate } from "@/hooks/use-debate";
import { getPersona } from "@/lib/debate/personas";
import { DebateConfig, DebateStage as DebateStageType, PersonaId, VoiceConfig } from "@/lib/debate/types";
import { StageIndicator } from "./stage-indicator";
import { PersonaAvatar } from "./persona-avatar";
import { TurnDisplay } from "./turn-display";
import { AiStreamingTurn } from "./ai-streaming-turn";
import { UserInput } from "./user-input";
import { FeedbackPanel } from "./feedback-panel";
import { SpeechToggle } from "./speech-toggle";
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
    stageLabel,
    stageInstruction,
    submitTurn,
    triggerAiTurn,
    requestFeedback,
    feedback,
    feedbackLoading,
  } = useDebate(debateId);

  const scrollRef = useRef<HTMLDivElement>(null);

  const config = debate ? (debate.config as DebateConfig) : null;
  const persona = config ? getPersona(config.personaId as PersonaId) : null;
  const defaultVoice: VoiceConfig = { pitch: 1, rate: 1, voicePrefs: [] };

  const { isMuted, toggleMute, isSupported } = useSpeech(
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

  // Auto-trigger AI turns
  useEffect(() => {
    if (isAiTurn && !isStreaming && debate) {
      triggerAiTurn();
    }
  }, [isAiTurn, isStreaming, debate?.current_stage]);

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PersonaAvatar
              persona={persona!}
              speaking={isStreaming}
              thinking={isAiTurn && !isStreaming}
              size="lg"
            />
            <SpeechToggle isMuted={isMuted} onToggle={toggleMute} isSupported={isSupported} />
          </div>
          <div className="text-right">
            <p className="text-xs text-stage-muted">Topic</p>
            <p className="text-sm font-medium">{config!.topic}</p>
          </div>
        </div>

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
    </div>
  );
}
