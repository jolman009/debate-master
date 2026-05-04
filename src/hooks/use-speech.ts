"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { VoiceConfig } from "@/lib/debate/types";

interface UseSpeechReturn {
  isMuted: boolean;
  toggleMute: () => void;
  isSupported: boolean;
  isSpeaking: boolean;
  amplitude: number;
}

const MUTE_KEY = "debate-tts-muted";
const BROWSER_PULSE_DECAY_MS = 220;
const BROWSER_PULSE_PEAK = 0.75;

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
  const [amplitude, setAmplitude] = useState(0);

  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const spokenIndexRef = useRef(0);
  const wasStreamingRef = useRef(false);

  const useElevenLabsRef = useRef<boolean>(!!voiceConfig.elevenLabsVoiceId);
  const queueRef = useRef<QueueItem[]>([]);
  const playerRunningRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllersRef = useRef<Set<AbortController>>(new Set());
  const isMutedRef = useRef(isMuted);

  // Web Audio analyser for amplitude visualization
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const wiredElementsRef = useRef<WeakSet<HTMLAudioElement>>(new WeakSet());
  const amplitudeRafRef = useRef<number | null>(null);
  const browserPulseRef = useRef<{ value: number; at: number } | null>(null);
  const amplitudeModeRef = useRef<"analyser" | "browser" | null>(null);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    useElevenLabsRef.current = !!voiceConfig.elevenLabsVoiceId;
  }, [voiceConfig.elevenLabsVoiceId]);

  useEffect(() => {
    setIsSupported(
      typeof window !== "undefined" &&
        ("speechSynthesis" in window || typeof Audio !== "undefined")
    );
  }, []);

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

  // ---- Audio context + analyser setup ----
  const ensureAudioContext = useCallback((): AudioContext | null => {
    if (audioCtxRef.current) return audioCtxRef.current;
    if (typeof window === "undefined") return null;
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    try {
      const ctx = new Ctor();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      return ctx;
    } catch {
      return null;
    }
  }, []);

  const wireAudioForAnalysis = useCallback(
    (audio: HTMLAudioElement) => {
      if (wiredElementsRef.current.has(audio)) return;
      const ctx = ensureAudioContext();
      const analyser = analyserRef.current;
      if (!ctx || !analyser) return;
      try {
        const source = ctx.createMediaElementSource(audio);
        source.connect(analyser);
        source.connect(ctx.destination);
        wiredElementsRef.current.add(audio);
      } catch {
        // Already connected or unavailable; fall back silently to default playback
      }
    },
    [ensureAudioContext]
  );

  const stopAmplitudeLoop = useCallback(() => {
    if (amplitudeRafRef.current !== null) {
      cancelAnimationFrame(amplitudeRafRef.current);
      amplitudeRafRef.current = null;
    }
    amplitudeModeRef.current = null;
    browserPulseRef.current = null;
    setAmplitude(0);
  }, []);

  const startAnalyserLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    if (amplitudeModeRef.current === "analyser") return;
    if (amplitudeRafRef.current !== null) {
      cancelAnimationFrame(amplitudeRafRef.current);
    }
    amplitudeModeRef.current = "analyser";
    const buf = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(buf);
      const n = Math.min(40, buf.length); // speech band lives in low bins
      let sum = 0;
      for (let i = 0; i < n; i++) sum += buf[i];
      const avg = sum / n / 255;
      setAmplitude(Math.min(1, avg * 1.6)); // small boost so quiet speech still shows
      amplitudeRafRef.current = requestAnimationFrame(tick);
    };
    amplitudeRafRef.current = requestAnimationFrame(tick);
  }, []);

  const startBrowserPulseLoop = useCallback(() => {
    if (amplitudeModeRef.current === "browser") return;
    if (amplitudeRafRef.current !== null) {
      cancelAnimationFrame(amplitudeRafRef.current);
    }
    amplitudeModeRef.current = "browser";
    const tick = () => {
      const pulse = browserPulseRef.current;
      if (pulse) {
        const elapsed = performance.now() - pulse.at;
        const t = Math.max(0, 1 - elapsed / BROWSER_PULSE_DECAY_MS);
        setAmplitude(pulse.value * t);
      } else {
        setAmplitude(0);
      }
      amplitudeRafRef.current = requestAnimationFrame(tick);
    };
    amplitudeRafRef.current = requestAnimationFrame(tick);
  }, []);

  const triggerBrowserPulse = useCallback(() => {
    browserPulseRef.current = {
      value: BROWSER_PULSE_PEAK,
      at: performance.now(),
    };
  }, []);

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

        startBrowserPulseLoop();
        triggerBrowserPulse();
        utterance.onboundary = () => triggerBrowserPulse();

        const finish = () => resolve();
        utterance.onend = finish;
        utterance.onerror = finish;
        speechSynthesis.speak(utterance);
      }),
    [
      voiceConfig.pitch,
      voiceConfig.rate,
      startBrowserPulseLoop,
      triggerBrowserPulse,
    ]
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
            useElevenLabsRef.current = false;
          }
          return null;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.crossOrigin = "anonymous";
        audio.addEventListener("ended", () => URL.revokeObjectURL(url));
        return audio;
      } catch (err) {
        if ((err as Error).name === "AbortError") return null;
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
        wireAudioForAnalysis(audio);
        const ctx = audioCtxRef.current;
        if (ctx && ctx.state === "suspended") {
          ctx.resume().catch(() => {});
        }
        startAnalyserLoop();
        const cleanup = () => {
          currentAudioRef.current = null;
          resolve();
        };
        audio.addEventListener("ended", cleanup, { once: true });
        audio.addEventListener("error", cleanup, { once: true });
        audio.play().catch(cleanup);
      }),
    [wireAudioForAnalysis, startAnalyserLoop]
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
        await speakViaBrowser(item.text);
      }
    }

    playerRunningRef.current = false;
    setIsSpeaking(false);
    stopAmplitudeLoop();
  }, [playAudio, speakViaBrowser, stopAmplitudeLoop]);

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
    stopAmplitudeLoop();
  }, [stopAmplitudeLoop]);

  useEffect(() => {
    if (isMuted) return;

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

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      localStorage.setItem(MUTE_KEY, String(next));
      if (next) stopAll();
      return next;
    });
  }, [stopAll]);

  useEffect(() => {
    return () => stopAll();
  }, [stopAll]);

  return { isMuted, toggleMute, isSupported, isSpeaking, amplitude };
}
