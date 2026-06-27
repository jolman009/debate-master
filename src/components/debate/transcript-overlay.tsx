"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DebateTurn } from "@/lib/debate/types";
import { TurnDisplay } from "./turn-display";

interface TranscriptOverlayProps {
  open: boolean;
  onClose: () => void;
  turns: DebateTurn[];
  personaName: string;
}

/**
 * Full-conversation transcript shown in a centered overlay panel. It layers on
 * top of the live debate UI without changing that layout, and the panel is
 * user-resizable via the native CSS resize handle (bottom-right corner).
 */
export function TranscriptOverlay({
  open,
  onClose,
  turns,
  personaName,
}: TranscriptOverlayProps) {
  const [mounted, setMounted] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    // Remember focus, move it into the dialog, restore it on close.
    prevFocusRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    // Lock background scroll while the overlay is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  // Jump to the latest turn each time the overlay opens.
  useEffect(() => {
    if (open && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Full debate transcript"
        onClick={(e) => e.stopPropagation()}
        style={{
          resize: "both",
          overflow: "hidden",
          width: "min(760px, 92vw)",
          height: "min(640px, 82vh)",
          minWidth: 320,
          minHeight: 240,
          maxWidth: "calc(100vw - 2rem)",
          maxHeight: "calc(100vh - 2rem)",
        }}
        className="flex flex-col bg-stage-bg border border-stage-border rounded-xl shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-stage-border shrink-0">
          <div>
            <p className="text-sm font-semibold text-stage-text">
              Full Transcript
            </p>
            <p className="text-xs text-stage-muted">
              {turns.length} {turns.length === 1 ? "turn" : "turns"}
            </p>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close transcript"
            className="rounded-lg p-1.5 text-stage-muted transition-colors hover:bg-stage-surface hover:text-stage-text"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Scrollable transcript */}
        <div
          ref={bodyRef}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4"
        >
          {turns.length === 0 ? (
            <p className="py-8 text-center text-sm text-stage-muted">
              No turns yet — the transcript fills in as the debate progresses.
            </p>
          ) : (
            turns.map((turn) => (
              <TurnDisplay
                key={turn.id}
                turn={turn}
                personaName={personaName}
              />
            ))
          )}
        </div>

        {/* Resize affordance */}
        <div className="shrink-0 select-none border-t border-stage-border px-4 py-1.5 text-right text-[10px] text-stage-muted">
          Drag the bottom-right corner to resize
        </div>
      </div>
    </div>,
    document.body
  );
}
