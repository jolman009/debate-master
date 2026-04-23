"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Persona } from "@/lib/debate/types";

interface PersonaAvatarProps {
  persona: Persona;
  speaking?: boolean;
  thinking?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  showName?: boolean;
}

const SIZE_CLASSES: Record<NonNullable<PersonaAvatarProps["size"]>, string> = {
  sm: "w-10 h-10 text-sm",
  md: "w-14 h-14 text-lg",
  lg: "w-20 h-20 text-2xl",
  xl: "w-32 h-32 text-4xl",
};

const SIZE_PIXELS: Record<NonNullable<PersonaAvatarProps["size"]>, string> = {
  sm: "40px",
  md: "56px",
  lg: "80px",
  xl: "128px",
};

export function PersonaAvatar({
  persona,
  speaking,
  thinking,
  size = "md",
  showName = true,
}: PersonaAvatarProps) {
  const { theme } = persona;
  const gradient = `linear-gradient(135deg, ${theme.from}, ${theme.to})`;

  const activeUrl = speaking
    ? persona.avatarUrlSpeaking || persona.avatarUrl
    : thinking
    ? persona.avatarUrlThinking || persona.avatarUrl
    : persona.avatarUrl;

  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const showImage = !!activeUrl && !failedUrls.has(activeUrl);

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex items-center justify-center">
        {speaking && (
          <>
            <span
              aria-hidden
              className="absolute inset-0 rounded-full animate-ping opacity-70 pointer-events-none"
              style={{ boxShadow: `0 0 0 3px ${theme.from}` }}
            />
            <span
              aria-hidden
              className="absolute -inset-1 rounded-full animate-pulse pointer-events-none"
              style={{ boxShadow: `0 0 24px 6px ${theme.glow}` }}
            />
          </>
        )}
        <div
          className={cn(
            "relative rounded-full flex items-center justify-center font-bold text-white overflow-hidden transition-transform duration-300",
            SIZE_CLASSES[size],
            speaking && "scale-105",
            thinking && !speaking && "animate-pulse-slow"
          )}
          style={{
            background: gradient,
            boxShadow: speaking
              ? `0 0 20px 2px ${theme.glow}, inset 0 0 0 2px ${theme.from}, inset 0 2px 6px rgba(255,255,255,0.18)`
              : thinking
              ? `0 0 14px 2px ${theme.glow}, inset 0 0 0 2px ${theme.from}, inset 0 2px 6px rgba(255,255,255,0.12)`
              : `inset 0 0 0 2px ${theme.from}, inset 0 2px 6px rgba(255,255,255,0.12)`,
          }}
        >
          {showImage ? (
            <Image
              key={activeUrl}
              src={activeUrl}
              alt={persona.displayName}
              fill
              sizes={SIZE_PIXELS[size]}
              className="object-cover"
              onError={() =>
                setFailedUrls((prev) => {
                  const next = new Set(prev);
                  next.add(activeUrl);
                  return next;
                })
              }
            />
          ) : (
            <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
              {persona.displayName[0]}
            </span>
          )}
        </div>
      </div>
      {showName && (
        <div>
          <p className={cn("font-semibold", size === "sm" && "text-sm")}>
            {persona.displayName}
          </p>
          <p className="text-xs text-stage-muted">{persona.tagline}</p>
        </div>
      )}
    </div>
  );
}
