"use client";

import { cn } from "@/lib/utils";
import { DebateTurn } from "@/lib/debate/types";
import { getStageLabel } from "@/lib/debate/state-machine";

interface TurnDisplayProps {
  turn: DebateTurn;
  personaName?: string;
}

export function TurnDisplay({ turn, personaName }: TurnDisplayProps) {
  const isUser = turn.role === "user";
  const stageLabel = getStageLabel(turn.stage);

  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        isUser ? "items-end" : "items-start"
      )}
    >
      <div className="flex items-center gap-2 text-xs text-stage-muted px-1">
        <span className="font-medium">
          {isUser ? "You" : personaName || "AI"}
        </span>
        <span>{stageLabel}</span>
      </div>
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
          isUser
            ? "bg-stage-accent/20 text-white border border-stage-accent/30"
            : "bg-stage-surface text-white border border-stage-border"
        )}
      >
        {turn.content}
      </div>
    </div>
  );
}
