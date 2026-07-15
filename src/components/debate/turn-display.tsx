"use client";

import { cn } from "@/lib/utils";
import { DebateTurn, Side } from "@/lib/debate/types";
import { getStageLabel } from "@/lib/debate/state-machine";

interface TurnDisplayProps {
  turn: DebateTurn;
  personaName?: string;
  // Human mode: the viewer's side, so their own turns sit on the right.
  viewerSide?: Side | null;
  opponentName?: string;
}

export function TurnDisplay({
  turn,
  personaName,
  viewerSide,
  opponentName,
}: TurnDisplayProps) {
  const isSideRole = turn.role === "pro" || turn.role === "con";
  // Human turns are "mine" when the role matches my side; AI turns when "user".
  const isUser = isSideRole ? turn.role === viewerSide : turn.role === "user";
  const authorLabel = isUser
    ? "You"
    : isSideRole
    ? opponentName || (turn.role === "pro" ? "Pro" : "Con")
    : personaName || "AI";
  const stageLabel = getStageLabel(turn.stage);

  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        isUser ? "items-end" : "items-start"
      )}
    >
      <div className="flex items-center gap-2 text-xs text-stage-muted px-1">
        <span className="font-medium">{authorLabel}</span>
        <span>{stageLabel}</span>
      </div>
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
          isUser
            ? "bg-stage-accent/20 text-stage-text border border-stage-accent/30"
            : "bg-stage-surface text-stage-text border border-stage-border"
        )}
      >
        {turn.content}
      </div>
    </div>
  );
}
