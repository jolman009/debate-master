"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { VoiceConfig } from "@/lib/debate/types";

interface UseSpeechReturn {
  isMuted: boolean;
  toggleMute: () => void;
  isSupported: boolean;
  isSpeaking: boolean;
}

const MUTE_KEY = "debate-tts-muted";

function getInitialMuted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(MUTE_KEY) === "true";
}

export function useSpeech(
  streamedText: string,
  isStreaming: boolean,
  voiceConfig: VoiceConfig
): UseSpeechReturn {
  const [isMuted, setIsMuted] = useState(getInitialMuted);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const spokenIndexRef = useRef(0);
  const wasStreamingRef = useRef(false);

  // Detect browser support
  useEffect(() => {
    setIsSupported(
      typeof window !== "undefined" && "speechSynthesis" in window
    );
  }, []);

  // Resolve preferred voice
  useEffect(() => {
    if (!isSupported) return;

    function resolveVoice() {
      const voices = speechSynthesis.getVoices();
      if (voices.length === 0) return;

      for (const pref of voiceConfig.voicePrefs) {
        const match = voices.find((v) => v.name.includes(pref));
        if (match) {
          voiceRef.current = match;
          return;
        }
      }
      // Fallback: first English voice, then default
      voiceRef.current =
        voices.find((v) => v.lang.startsWith("en")) || voices[0] || null;
    }

    resolveVoice();
    speechSynthesis.addEventListener("voiceschanged", resolveVoice);
    return () => {
      speechSynthesis.removeEventListener("voiceschanged", resolveVoice);
    };
  }, [isSupported, voiceConfig.voicePrefs]);

  // Speak a chunk of text
  const speak = useCallback(
    (text: string) => {
      if (!isSupported || isMuted || !text.trim()) return;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.pitch = voiceConfig.pitch;
      utterance.rate = voiceConfig.rate;
      if (voiceRef.current) utterance.voice = voiceRef.current;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        if (speechSynthesis.pending) return;
        setIsSpeaking(false);
      };

      speechSynthesis.speak(utterance);
    },
    [isSupported, isMuted, voiceConfig.pitch, voiceConfig.rate]
  );

  // Buffer and speak sentence by sentence as text streams in
  useEffect(() => {
    if (!isSupported || isMuted) return;

    // If streamedText was cleared (new turn), reset tracking
    if (streamedText.length < spokenIndexRef.current) {
      spokenIndexRef.current = 0;
      speechSynthesis.cancel();
      return;
    }

    const newText = streamedText.slice(spokenIndexRef.current);
    if (!newText) return;

    // Match complete sentences (ending with . ! ? or : followed by space/end)
    const sentenceRegex = /[^.!?:]*[.!?:](?:\s|$)/g;
    let match: RegExpExecArray | null;
    let consumed = 0;

    while ((match = sentenceRegex.exec(newText)) !== null) {
      speak(match[0]);
      consumed = match.index + match[0].length;
    }

    if (consumed > 0) {
      spokenIndexRef.current += consumed;
    }
  }, [streamedText, isSupported, isMuted, speak]);

  // Flush remaining text when streaming ends
  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming) {
      const remaining = streamedText.slice(spokenIndexRef.current);
      if (remaining.trim()) {
        speak(remaining);
      }
      spokenIndexRef.current = 0;
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming, streamedText, speak]);

  // Mute toggle
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      localStorage.setItem(MUTE_KEY, String(next));
      if (next) {
        speechSynthesis.cancel();
        setIsSpeaking(false);
      }
      return next;
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      speechSynthesis.cancel();
    };
  }, []);

  return { isMuted, toggleMute, isSupported, isSpeaking };
}
