"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DebateTurn } from "@/lib/debate/types";
import { TurnDisplay } from "./turn-display";
import { isFeatureEnabled } from "@/lib/flags";

interface TranscriptOverlayProps {
  open: boolean;
  onClose: () => void;
  turns: DebateTurn[];
  personaName: string;
}

/**
 * Full-conversation transcript.
 * With ui_live_v2:
 * - Mobile (<768px): Adaptive bottom sheet sliding up from bottom with safe-area padding.
 * - Desktop (>=768px): Supporting side panel / floating workspace that stays alongside stage.
 * Fallback: Centered resizable dialog.
 */
export function TranscriptOverlay({
  open,
  onClose,
  turns,
  personaName,
}: TranscriptOverlayProps) {
  const [mounted, setMounted] = useState(false);
  const [desktopMode, setDesktopMode] = useState<"side-panel" | "dialog">("side-panel");
  const closeRef = useRef<HTMLButtonElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const useV2 = isFeatureEnabled("ui_live_v2");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    // Remember focus, move it into the dialog, restore it on close.
    prevFocusRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[role="dialog"] a, [role="dialog"] button, [role="dialog"] [tabindex]:not([tabindex="-1"])'
        )
      ).filter((node) => !node.hasAttribute("disabled"));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
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
      className="motion-overlay fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end bg-black/60 p-0 sm:p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Full debate transcript"
        onClick={(e) => e.stopPropagation()}
        style={
          useV2
            ? desktopMode === "dialog"
              ? {
                  resize: "both",
                  overflow: "hidden",
                  width: "min(760px, 92vw)",
                  height: "min(640px, 82vh)",
                  minWidth: 320,
                  minHeight: 240,
                  maxWidth: "calc(100vw - 2rem)",
                  maxHeight: "calc(100vh - 2rem)",
                }
              : undefined
            : {
                resize: "both",
                overflow: "hidden",
                width: "min(760px, 92vw)",
                height: "min(640px, 82vh)",
                minWidth: 320,
                minHeight: 240,
                maxWidth: "calc(100vw - 2rem)",
                maxHeight: "calc(100vh - 2rem)",
              }
        }
        className={
          useV2
            ? desktopMode === "side-panel"
              ? "motion-sheet sm:motion-side-panel flex flex-col w-full sm:w-[460px] max-w-full h-[78vh] sm:h-full sm:max-h-[96vh] rounded-t-2xl sm:rounded-l-2xl sm:rounded-r-none border-t sm:border-y sm:border-l border-stage-border bg-stage-bg shadow-2xl pb-[env(safe-area-inset-bottom)] sm:pb-0"
              : "motion-dialog flex flex-col rounded-lg border border-stage-border bg-stage-bg shadow-2xl"
            : "motion-dialog flex flex-col rounded-lg border border-stage-border bg-stage-bg shadow-2xl"
        }
      >
        {/* Mobile Pull Handle */}
        {useV2 && desktopMode === "side-panel" && (
          <div className="flex justify-center pt-2 pb-1 sm:hidden">
            <div className="h-1.5 w-12 rounded-full bg-stage-border" />
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-stage-border shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-stage-text">
                Full Transcript
              </p>
              <span className="rounded bg-stage-surface-raised px-1.5 py-0.5 text-[11px] font-medium text-stage-warning border border-stage-warning/30">
                AI Simulation
              </span>
            </div>
            <p className="text-xs text-stage-muted">
              {turns.length} {turns.length === 1 ? "turn" : "turns"} · Opponent turns are AI simulated
            </p>
          </div>
          <div className="flex items-center gap-1">
            {useV2 && (
              <button
                type="button"
                onClick={() =>
                  setDesktopMode((prev) =>
                    prev === "side-panel" ? "dialog" : "side-panel"
                  )
                }
                title={
                  desktopMode === "side-panel"
                    ? "Switch to centered dialog"
                    : "Switch to side panel"
                }
                aria-label={
                  desktopMode === "side-panel"
                    ? "Switch to centered dialog"
                    : "Switch to side panel"
                }
                className="hidden sm:inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg p-1.5 text-stage-muted transition-colors hover:bg-stage-surface hover:text-stage-text text-xs"
              >
                {desktopMode === "side-panel" ? (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="9" y1="3" x2="9" y2="21" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="15" y1="3" x2="15" y2="21" />
                  </svg>
                )}
              </button>
            )}
            <button
              ref={closeRef}
              onClick={onClose}
              aria-label="Close transcript"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-stage-muted transition-colors hover:bg-stage-surface hover:text-stage-text"
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

        {/* Resize affordance for centered dialog */}
        {(!useV2 || desktopMode === "dialog") && (
          <div className="shrink-0 select-none border-t border-stage-border px-4 py-1.5 text-right text-xs text-stage-muted">
            Drag the bottom-right corner to resize
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
