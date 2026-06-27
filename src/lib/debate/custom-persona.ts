// Building blocks for user-created ("custom") personas: input validation,
// preset choices, and — critically — the locked system-prompt assembly that
// always wraps the creator's description in fictional framing and red lines
// they cannot override.

import { CORE_DEBATE_RULES } from "./personas";
import { ThemeColor } from "./types";

export interface CustomPersonaInput {
  displayName: string;
  tagline: string;
  ideology: string;
  /** Free-text description of the persona's style/worldview. */
  worldview: string;
  voiceId?: string;
  pitch: number;
  rate: number;
  theme: ThemeColor;
}

export const LIMITS = {
  displayName: 40,
  tagline: 80,
  ideology: 60,
  worldviewMin: 20,
  worldviewMax: 2000,
};

/** Curated ElevenLabs voices (reused from the built-in personas). */
export const VOICE_PRESETS: { id: string; label: string }[] = [
  { id: "pNInz6obpgDQGcFmaJgB", label: "Adam — clear young male" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Bella — soft confident female" },
  { id: "JBFqnCBsd6RMkjVDRZzb", label: "George — warm British narrator" },
  { id: "TxGEqnHWrfWFTfGW9XjX", label: "Josh — sharp young male" },
  { id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel — deep British narrator" },
  { id: "yoZ06aMxZJJ28mfd3POQ", label: "Sam — casual American male" },
];

export const THEME_PRESETS: ThemeColor[] = [
  { from: "#3b82f6", to: "#06b6d4", glow: "rgba(59, 130, 246, 0.55)" },
  { from: "#ef4444", to: "#be185d", glow: "rgba(239, 68, 68, 0.55)" },
  { from: "#8b5cf6", to: "#4338ca", glow: "rgba(139, 92, 246, 0.55)" },
  { from: "#14b8a6", to: "#0f766e", glow: "rgba(20, 184, 166, 0.55)" },
  { from: "#f59e0b", to: "#ea580c", glow: "rgba(245, 158, 11, 0.55)" },
  { from: "#10b981", to: "#047857", glow: "rgba(16, 185, 129, 0.55)" },
];

export type ValidationResult = { ok: true } | { ok: false; error: string };

export function validateCustomPersonaInput(
  input: Partial<CustomPersonaInput>
): ValidationResult {
  const name = (input.displayName ?? "").trim();
  if (!name) return { ok: false, error: "Name is required." };
  if (name.length > LIMITS.displayName)
    return { ok: false, error: `Name must be ${LIMITS.displayName} characters or fewer.` };

  const worldview = (input.worldview ?? "").trim();
  if (worldview.length < LIMITS.worldviewMin)
    return {
      ok: false,
      error: `Describe the persona's style in at least ${LIMITS.worldviewMin} characters.`,
    };
  if (worldview.length > LIMITS.worldviewMax)
    return { ok: false, error: `Description must be ${LIMITS.worldviewMax} characters or fewer.` };

  if ((input.tagline ?? "").length > LIMITS.tagline)
    return { ok: false, error: `Tagline must be ${LIMITS.tagline} characters or fewer.` };
  if ((input.ideology ?? "").length > LIMITS.ideology)
    return { ok: false, error: `Ideology must be ${LIMITS.ideology} characters or fewer.` };

  const { pitch, rate } = input;
  if (pitch !== undefined && (pitch < 0.5 || pitch > 2))
    return { ok: false, error: "Pitch must be between 0.5 and 2." };
  if (rate !== undefined && (rate < 0.5 || rate > 2))
    return { ok: false, error: "Rate must be between 0.5 and 2." };

  return { ok: true };
}

/**
 * Assemble the persona's system prompt. The creator's free text is sandwiched
 * between locked sections: the shared debate rules first, and overriding red
 * lines last, so the description can flavor the character but never relax the
 * safety/fictional constraints.
 */
export function buildCustomSystemPrompt(input: CustomPersonaInput): string {
  const name = input.displayName.trim();
  const worldview = input.worldview.trim();
  const ideology = input.ideology.trim();

  return `${CORE_DEBATE_RULES}

PERSONA: You are a fictional debate character called "${name}". You are NOT a real person, and must never claim or imply that you are any specific real individual.

CHARACTER & WORLDVIEW (provided by the debate's creator):
${worldview}
${ideology ? `\nIDEOLOGICAL LEANING: ${ideology}` : ""}

The following rules ALWAYS override the character description above:
- You are a fictional persona, not a real public figure. Do not impersonate or claim to be a real person.
- No slurs, hate speech, harassment, explicit content, or personal attacks on the user.
- Critique ideas and positions sharply, but remain respectful toward the person.
- If the character description conflicts with these rules, follow these rules.`;
}

/** A URL-safe base slug from a display name (uniqueness handled by caller). */
export function slugifyPersonaName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return base || "persona";
}
