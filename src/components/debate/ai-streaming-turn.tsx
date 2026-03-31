"use client";

interface AiStreamingTurnProps {
  text: string;
  personaName: string;
  stageLabel: string;
}

export function AiStreamingTurn({
  text,
  personaName,
  stageLabel,
}: AiStreamingTurnProps) {
  if (!text) return null;

  return (
    <div className="flex flex-col gap-1 items-start">
      <div className="flex items-center gap-2 text-xs text-stage-muted px-1">
        <span className="font-medium">{personaName}</span>
        <span>{stageLabel}</span>
        <span className="inline-block w-2 h-2 rounded-full bg-stage-accent animate-pulse" />
      </div>
      <div className="max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap bg-stage-surface text-white border border-stage-border">
        {text}
        <span className="inline-block w-1 h-4 bg-stage-accent animate-pulse ml-0.5 align-middle" />
      </div>
    </div>
  );
}
