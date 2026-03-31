"use client";

import { cn } from "@/lib/utils";
import { Persona } from "@/lib/debate/types";

interface PersonaAvatarProps {
  persona: Persona;
  speaking?: boolean;
  size?: "sm" | "md" | "lg";
}

export function PersonaAvatar({
  persona,
  speaking,
  size = "md",
}: PersonaAvatarProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "rounded-full bg-stage-accent/20 flex items-center justify-center text-stage-accent font-bold",
          speaking && "ring-2 ring-stage-accent animate-pulse-slow",
          size === "sm" && "w-8 h-8 text-sm",
          size === "md" && "w-12 h-12 text-lg",
          size === "lg" && "w-16 h-16 text-2xl"
        )}
      >
        {persona.displayName[0]}
      </div>
      <div>
        <p className={cn("font-semibold", size === "sm" && "text-sm")}>
          {persona.displayName}
        </p>
        <p className="text-xs text-stage-muted">{persona.tagline}</p>
      </div>
    </div>
  );
}
