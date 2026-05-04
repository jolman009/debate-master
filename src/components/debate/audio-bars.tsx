"use client";

import { useEffect, useRef, useState } from "react";

interface AudioBarsProps {
  amplitude: number;
  active: boolean;
  color: string;
  bars?: number;
}

// Per-bar response curves so the visualization doesn't look like a single
// rectangle scaling. Bars in the middle are slightly more responsive.
const DEFAULT_PROFILE = [0.55, 0.85, 1.0, 0.85, 0.55];

export function AudioBars({
  amplitude,
  active,
  color,
  bars = 5,
}: AudioBarsProps) {
  const profile = bars === 5 ? DEFAULT_PROFILE : buildProfile(bars);
  const [jitter, setJitter] = useState<number[]>(() => profile.map(() => 1));
  const rafRef = useRef<number | null>(null);

  // Tiny per-frame jitter so bars feel alive even at steady amplitudes.
  useEffect(() => {
    if (!active) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setJitter(profile.map(() => 1));
      return;
    }
    const tick = () => {
      setJitter(profile.map(() => 0.85 + Math.random() * 0.3));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [active, profile]);

  return (
    <div
      aria-hidden
      className="flex items-end gap-1 h-6"
      style={{ opacity: active ? 1 : 0.25 }}
    >
      {profile.map((weight, i) => {
        const level = active
          ? Math.max(0.12, Math.min(1, amplitude * weight * jitter[i]))
          : 0.18;
        return (
          <span
            key={i}
            className="w-1.5 rounded-full transition-[height] duration-75 ease-out"
            style={{
              height: `${level * 100}%`,
              backgroundColor: color,
            }}
          />
        );
      })}
    </div>
  );
}

function buildProfile(n: number): number[] {
  const out: number[] = [];
  const mid = (n - 1) / 2;
  for (let i = 0; i < n; i++) {
    const dist = Math.abs(i - mid) / mid;
    out.push(1 - dist * 0.45);
  }
  return out;
}
