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

type QueueItem = { text: string; audio: Promise<HTMLAudioElement | null> };

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

  // ElevenLabs queue + playback state. Refs (not state) so callbacks see latest.
  const useElevenLabsRef = useRef<boolean>(!!voiceConfig.elevenLabsVoiceId);
  const queueRef = useRef<QueueItem[]>([]);
  const playerRunningRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllersRef = useRef<Set<AbortController>>(new Set());
  const isMutedRef = useRef(isMuted);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    useElevenLabsRef.current = !!voiceConfig.elevenLabsVoiceId;
  }, [voiceConfig.elevenLabsVoiceId]);

  // Detect browser support (audio playback or speechSynthesis)
  useEffect(() => {
    setIsSupported(
      typeof window !== "undefined" &&
        ("speechSynthesis" in window || typeof Audio !== "undefined")
    );
  }, []);

  // Resolve preferred browser voice (used as fallback)
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

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
      voiceRef.current =
        voices.find((v) => v.lang.startsWith("en")) || voices[0] || null;
    }

    resolveVoice();
    speechSynthesis.addEventListener("voiceschanged", resolveVoice);
    return () => {
      speechSynthesis.removeEventListener("voiceschanged", resolveVoice);
    };
  }, [voiceConfig.voicePrefs]);

  // ---- Browser SpeechSynthesis fallback ----
  const speakViaBrowser = useCallback(
    (text: string): Promise<void> =>
      new Promise((resolve) => {
        if (
          typeof window === "undefined" ||
          !("speechSynthesis" in window) ||
          !text.trim()
        ) {
          return resolve();
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.pitch = voiceConfig.pitch;
        utterance.rate = voiceConfig.rate;
        if (voiceRef.current) utterance.voice = voiceRef.current;
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        speechSynthesis.speak(utterance);
      }),
    [voiceConfig.pitch, voiceConfig.rate]
  );

  // ---- ElevenLabs fetch ----
  const fetchElevenLabsAudio = useCallback(
    async (text: string, voiceId: string): Promise<HTMLAudioElement | null> => {
      const ac = new AbortController();
      abortControllersRef.current.add(ac);
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voiceId }),
          signal: ac.signal,
        });
        if (!res.ok) {
          if (res.status === 503) {
            // Server says no key configured → fall back permanently this session
            useElevenLabsRef.current = false;
          }
          return null;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.addEventListener("ended", () => URL.revokeObjectURL(url));
        return audio;
      } catch (err) {
        if ((err as Error).name === "AbortError") return null;
        // Network error → fall back to browser for remaining sentences
        useElevenLabsRef.current = false;
        return null;
      } finally {
        abortControllersRef.current.delete(ac);
      }
    },
    []
  );

  const playAudio = useCallback(
    (audio: HTMLAudioElement): Promise<void> =>
      new Promise((resolve) => {
        currentAudioRef.current = audio;
        const cleanup = () => {
          currentAudioRef.current = null;
          resolve();
        };
        audio.addEventListener("ended", cleanup, { once: true });
        audio.addEventListener("error", cleanup, { once: true });
        audio.play().catch(cleanup);
      }),
    []
  );

  const startPlayer = useCallback(async () => {
    if (playerRunningRef.current) return;
    playerRunningRef.current = true;
    setIsSpeaking(true);

    while (queueRef.current.length > 0) {
      if (isMutedRef.current) {
        queueRef.current = [];
        break;
      }
      const item = queueRef.current.shift()!;
      const audio = await item.audio;
      if (isMutedRef.current) break;

      if (audio) {
        await playAudio(audio);
      } else if (item.text.trim()) {
        // Fall back to browser TTS for this sentence
        await speakViaBrowser(item.text);
      }
    }

    playerRunningRef.current = false;
    setIsSpeaking(false);
  }, [playAudio, speakViaBrowser]);

  const enqueue = useCallback(
    (text: string) => {
      if (isMutedRef.current || !text.trim()) return;

      const voiceId = voiceConfig.elevenLabsVoiceId;
      const audioPromise =
        useElevenLabsRef.current && voiceId
          ? fetchElevenLabsAudio(text, voiceId)
          : Promise.resolve(null);

      queueRef.current.push({ text, audio: audioPromise });
      startPlayer();
    },
    [voiceConfig.elevenLabsVoiceId, fetchElevenLabsAudio, startPlayer]
  );

  // ---- Stop everything (mute, unmount, new turn) ----
  const stopAll = useCallback(() => {
    queueRef.current = [];
    abortControllersRef.current.forEach((ac) => ac.abort());
    abortControllersRef.current.clear();
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  // ---- Buffer and enqueue sentences as text streams in ----
  useEffect(() => {
    if (isMuted) return;

    // If streamedText was cleared (new turn), reset tracking
    if (streamedText.length < spokenIndexRef.current) {
      spokenIndexRef.current = 0;
      stopAll();
      return;
    }

    const newText = streamedText.slice(spokenIndexRef.current);
    if (!newText) return;

    const sentenceRegex = /[^.!?:]*[.!?:](?:\s|$)/g;
    let match: RegExpExecArray | null;
    let consumed = 0;

    while ((match = sentenceRegex.exec(newText)) !== null) {
      enqueue(match[0]);
      consumed = match.index + match[0].length;
    }

    if (consumed > 0) {
      spokenIndexRef.current += consumed;
    }
  }, [streamedText, isMuted, enqueue, stopAll]);

  // ---- Flush remaining text when streaming ends ----
  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming) {
      const remaining = streamedText.slice(spokenIndexRef.current);
      if (remaining.trim()) {
        enqueue(remaining);
      }
      spokenIndexRef.current = 0;
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming, streamedText, enqueue]);

  // ---- Mute toggle ----
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      localStorage.setItem(MUTE_KEY, String(next));
      if (next) stopAll();
      return next;
    });
  }, [stopAll]);

  // ---- Cleanup on unmount ----
  useEffect(() => {
    return () => stopAll();
  }, [stopAll]);

  return { isMuted, toggleMute, isSupported, isSpeaking };
}
