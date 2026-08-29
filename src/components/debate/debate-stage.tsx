"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useDebate } from "@/hooks/use-debate";
import { DebateConfig, DebateStage as DebateStageType, Persona, VoiceConfig } from "@/lib/debate/types";
import { StageIndicator } from "./stage-indicator";
import { LiveStage } from "./live-stage";
import { TurnDisplay } from "./turn-display";
import { AiStreamingTurn } from "./ai-streaming-turn";
import { UserInput } from "./user-input";
import { FeedbackPanel } from "./feedback-panel";
import { SpeechToggle } from "./speech-toggle";
import { TranscriptOverlay } from "./transcript-overlay";
import { ShareDebate } from "./share-debate";
import { InvitePanel } from "./invite-panel";
import { TypingIndicator } from "./typing-indicator";
import { JudgePanel } from "./judge-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSpeech } from "@/hooks/use-speech";

interface DebateStageProps {
  debateId: string;
  persona: Persona;
}

export function DebateStage({ debateId, persona }: DebateStageProps) {
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
    isHuman,
    waitingForOpponent,
    inviteToken,
    viewerSide,
    opponent,
    refresh,
    realtimeConnected,
    onlineSides,
    opponentTyping,
    broadcastTyping,
    judgeResult,
    ratingDelta,
    userAvatarUrl,
    updateUserAvatar,
    opponentAvatarUrl,
  } = useDebate(debateId);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [completionAnnouncement, setCompletionAnnouncement] = useState("");
  const wasStreamingRef = useRef(false);

  const config = debate ? (debate.config as DebateConfig) : null;
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
  // Human mode never calls Gemini, so this stays gated to AI mode.
  useEffect(() => {
    if (!isHuman && isAiTurn && !isStreaming && debate && !streamError) {
      triggerAiTurn();
    }
  }, [isHuman, isAiTurn, isStreaming, debate, streamError, triggerAiTurn]);

  // Fallback polling for human mode: realtime (Phase B) is the primary sync,
  // so this only runs when the channel is NOT connected (e.g. before subscribe,
  // or after a dropped socket). Polls while it's not our turn; stops once it's
  // our turn, the debate ends, or realtime takes over.
  useEffect(() => {
    if (!isHuman || realtimeConnected) return;
    const stage = debate?.current_stage;
    const terminal = stage === "complete" || stage === "judge";
    if (isMyTurn || terminal) return;
    const id = setInterval(() => refresh(), 4000);
    return () => clearInterval(id);
  }, [isHuman, realtimeConnected, isMyTurn, debate?.current_stage, refresh]);

  useEffect(() => {
    if (isStreaming) {
      setCompletionAnnouncement("");
    }
    if (wasStreamingRef.current && !isStreaming) {
      setCompletionAnnouncement("AI response complete.");
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming]);

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
  const isJudgeStage = currentStage === "judge";
  const isComplete = currentStage === "complete";
  const opponentTurnPending =
    isHuman && !waitingForOpponent && !isMyTurn && !isComplete && !isJudgeStage;
  const opponentName = "Opponent";
  const opponentSide: "pro" | "con" = viewerSide === "pro" ? "con" : "pro";
  const opponentOnline = isHuman && onlineSides.includes(opponentSide);
  const liveStatus = streamError
    ? `Connection or response error: ${streamError}`
    : completionAnnouncement
    ? completionAnnouncement
    : isMyTurn
    ? "Your turn."
    : isAiTurn
    ? isStreaming
      ? "AI response in progress."
      : "AI thinking."
    : isHuman && !realtimeConnected
    ? "Realtime connection interrupted. Trying to reconnect."
    : opponentTurnPending
    ? "Waiting for your opponent."
    : "";

  return (
    <div className="mx-auto flex h-[100svh] max-w-3xl flex-col px-3 py-2 sm:px-4 sm:py-4 supports-[height:100dvh]:h-[100dvh]">
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {liveStatus}
      </div>
      {/* Header */}
      <div className="space-y-2 sm:space-y-3 shrink-0">
        <header
          aria-label="Debate controls"
          className="space-y-2"
        >
          {/* Top navigation & tools bar */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Link
                href="/debate"
                className="inline-flex min-h-9 items-center rounded-lg pr-2 text-xs sm:text-sm font-medium text-stage-muted transition-colors hover:text-stage-text"
                aria-label="Back to debate library"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                Library
              </Link>
              {!isHuman ? (
                <Badge variant="accent" className="text-[10px] sm:text-xs py-0.5 px-2">AI simulation</Badge>
              ) : (
                <Badge className="text-[10px] sm:text-xs py-0.5 px-2">Human debate</Badge>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1" aria-label="Debate tools">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTranscript(true)}
                aria-label="Open full transcript"
                title="View full transcript"
                className="gap-1.5 h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm"
              >
                <svg
                  width="16"
                  height="16"
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

          {/* Full-width Motion Statement */}
          <div className="w-full">
            <p className="mb-0.5 text-[10px] sm:text-xs uppercase tracking-wider text-stage-muted">
              Motion
            </p>
            <h1
              className="w-full text-xs sm:text-sm md:text-base font-semibold leading-snug text-stage-text break-words"
              title={config!.motion || config!.topic}
              aria-label={`Motion: ${config!.motion || config!.topic}`}
            >
              {config!.motion || config!.topic}
            </h1>
          </div>
        </header>

        <LiveStage
          persona={persona!}
          userSide={isHuman ? viewerSide ?? config!.userSide : config!.userSide}
          isStreaming={isStreaming}
          isSpeaking={isSpeaking}
          isAiTurn={isAiTurn}
          isMyTurn={isMyTurn}
          amplitude={amplitude}
          isHuman={isHuman}
          opponentJoined={!waitingForOpponent}
          opponentActive={opponentTurnPending}
          opponentName={opponentName}
          opponentOnline={opponentOnline}
          opponentTyping={opponentTyping}
          userAvatarUrl={userAvatarUrl}
          onAvatarUpload={updateUserAvatar}
          opponentAvatarUrl={opponentAvatarUrl}
        />

        <StageIndicator config={config!} currentStage={currentStage} />

        {/* Stage banner */}
        {!isComplete && (
          <div key={currentStage} className="motion-status border-y border-stage-border px-3 py-1.5 sm:px-4 sm:py-2.5 text-center">
            <p className="text-xs sm:text-sm font-semibold text-stage-accent">
              {stageLabel}
            </p>
            {stageInstruction && (
              <p className="text-[11px] sm:text-xs text-stage-muted mt-0.5 sm:mt-1">
                {stageInstruction}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Turns */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto py-2 sm:py-4 space-y-3 sm:space-y-4 min-h-0"
      >
        {debate.turns.map((turn) => (
          <TurnDisplay
            key={turn.id}
            turn={turn}
            personaName={persona!.displayName}
            viewerSide={viewerSide}
            opponentName={opponentName}
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
      <div className="shrink-0 pt-2 sm:pt-4 border-t border-stage-border">
        {streamError && (
          <div role="alert" className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-stage-con/40 bg-stage-con/10 px-3 py-2">
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
        {!isHuman && isFeedbackStage && !feedback && (
          <div className="text-center py-4">
            <p className="text-stage-muted text-sm mb-3">
              The debate is over. Get AI-generated coaching on your performance.
            </p>
            <Button onClick={requestFeedback} disabled={feedbackLoading}>
              {feedbackLoading ? "Generating Feedback..." : "Get Feedback"}
            </Button>
          </div>
        )}

        {waitingForOpponent && (
          <InvitePanel inviteToken={inviteToken} viewerSide={viewerSide} />
        )}

        {opponentTurnPending && (
          <div className="py-4">
            {opponentTyping ? (
              <TypingIndicator name={opponentName} />
            ) : (
              <p className="text-center text-sm text-stage-muted">
                Waiting for your opponent to respond…
              </p>
            )}
          </div>
        )}

        {isHuman && isJudgeStage && !judgeResult && (
          <div className="text-center py-4">
            <p className="text-stage-muted text-sm mb-3">
              Both sides have finished. Let the judge decide the winner.
            </p>
            <Button onClick={requestFeedback} disabled={feedbackLoading}>
              {feedbackLoading ? "The judge is deliberating..." : "Get the Verdict"}
            </Button>
          </div>
        )}

        {isHuman && judgeResult && (
          <JudgePanel
            judge={judgeResult}
            viewerSide={viewerSide}
            ratingDelta={ratingDelta}
          />
        )}

        {feedback && <FeedbackPanel feedback={feedback} />}

        {(isComplete || isFeedbackStage) && (
          <div className="mt-3 flex justify-center">
            <ShareDebate
              debateId={debate.id}
              initialShareToken={debate.share_token ?? null}
            />
          </div>
        )}

        {isComplete && !feedback && !judgeResult && (
          <div className="text-center py-4">
            <p className="text-stage-muted text-sm">Debate complete!</p>
          </div>
        )}

        {isMyTurn && !isStreaming && (
          <>
            {isHuman && opponentTyping && (
              <div className="mb-2">
                <TypingIndicator name={opponentName} />
              </div>
            )}
            <UserInput
              onSubmit={submitTurn}
              disabled={isStreaming}
              placeholder={stageInstruction || "Enter your argument..."}
              onTyping={isHuman ? broadcastTyping : undefined}
            />
          </>
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
