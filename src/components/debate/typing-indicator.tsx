"use client";

interface TypingIndicatorProps {
  name: string;
}

// "<name> is typing…" with three animated dots. Driven by the realtime
// `typing` broadcast (Phase B).
export function TypingIndicator({ name }: TypingIndicatorProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-stage-muted">
      <span className="flex items-center gap-1" aria-hidden>
        <Dot delay="0ms" />
        <Dot delay="150ms" />
        <Dot delay="300ms" />
      </span>
      <span>{name} is typing…</span>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full bg-stage-accent animate-bounce"
      style={{ animationDelay: delay }}
    />
  );
}
