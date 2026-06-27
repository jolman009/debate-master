"use client";

import { MouseEvent, useRef, useState } from "react";
import { Persona } from "@/lib/debate/types";

const PREVIEW_LINE =
  "Step onto the stage. I hope you came ready to defend your position.";

type State = "idle" | "loading" | "playing";

/**
 * Small play control that previews a persona's voice — ElevenLabs when a
 * voice id is configured, otherwise the browser SpeechSynthesis fallback.
 * Sits inside a clickable persona card, so clicks must not bubble.
 */
export function VoicePreviewButton({ persona }: { persona: Persona }) {
  const [state, setState] = useState<State>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function stop() {
    audioRef.current?.pause();
    audioRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setState("idle");
  }

  function speakViaBrowser() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setState("idle");
      return;
    }
    const u = new SpeechSynthesisUtterance(PREVIEW_LINE);
    u.pitch = persona.voiceConfig.pitch;
    u.rate = persona.voiceConfig.rate;
    u.onend = () => setState("idle");
    u.onerror = () => setState("idle");
    setState("playing");
    window.speechSynthesis.speak(u);
  }

  async function preview(e: MouseEvent) {
    e.stopPropagation(); // don't select the persona card
    if (state !== "idle") {
      stop();
      return;
    }

    setState("loading");
    const voiceId = persona.voiceConfig.elevenLabsVoiceId;

    if (voiceId) {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: PREVIEW_LINE, voiceId }),
        });
        if (res.ok) {
          const url = URL.createObjectURL(await res.blob());
          const audio = new Audio(url);
          audioRef.current = audio;
          const done = () => {
            URL.revokeObjectURL(url);
            setState("idle");
          };
          audio.addEventListener("ended", done, { once: true });
          audio.addEventListener("error", done, { once: true });
          setState("playing");
          await audio.play();
          return;
        }
      } catch {
        // fall through to the browser fallback
      }
    }

    speakViaBrowser();
  }

  return (
    <button
      type="button"
      onClick={preview}
      aria-label={
        state === "playing"
          ? `Stop ${persona.displayName}'s voice preview`
          : `Preview ${persona.displayName}'s voice`
      }
      title="Preview voice"
      className="absolute right-2 top-2 z-10 rounded-full bg-stage-bg/80 p-1.5 text-stage-muted backdrop-blur transition-colors hover:text-stage-accent"
    >
      {state === "loading" ? (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden>
          <circle
            cx="12"
            cy="12"
            r="9"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray="42"
            strokeLinecap="round"
          />
        </svg>
      ) : state === "playing" ? (
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
          <rect x="6" y="6" width="12" height="12" rx="1.5" />
        </svg>
      ) : (
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      )}
    </button>
  );
}
