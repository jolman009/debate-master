import { describe, it, expect } from "vitest";
import {
  PERSONAS,
  PERSONA_ALIASES,
  getPersona,
  getAllPersonas,
  FALLBACK_PERSONA,
} from "./personas";
import fs from "fs";
import path from "path";

describe("personas module", () => {
  const publicDir = path.join(process.cwd(), "public");

  it("exports 6 built-in original intellectual archetypes", () => {
    const personas = getAllPersonas();
    expect(personas).toHaveLength(6);
    const ids = personas.map((p) => p.id);
    expect(ids).toEqual([
      "the-consequentialist",
      "the-logician",
      "the-contrarian",
      "the-presuppositionalist",
      "the-traditionalist",
      "the-voluntaryist",
    ]);
  });

  it("each persona has valid attributes, prompts, and distinct themes", () => {
    for (const persona of getAllPersonas()) {
      expect(persona.id).toBeTruthy();
      expect(persona.displayName).toBeTruthy();
      expect(persona.tagline).toBeTruthy();
      expect(persona.ideology).toBeTruthy();
      expect(persona.systemPrompt).toContain("DEBATE FORMAT RULES");
      expect(persona.systemPrompt).toContain("RED LINES");
      expect(persona.theme.from).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(persona.theme.to).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(persona.voiceConfig.pitch).toBeGreaterThan(0);
      expect(persona.voiceConfig.rate).toBeGreaterThan(0);
    }
  });

  it("each persona avatar image exists in public folder", () => {
    for (const persona of getAllPersonas()) {
      const defaultPath = path.join(publicDir, persona.avatarUrl);
      expect(fs.existsSync(defaultPath)).toBe(true);

      if (persona.avatarUrlSpeaking) {
        const speakingPath = path.join(publicDir, persona.avatarUrlSpeaking);
        expect(fs.existsSync(speakingPath)).toBe(true);
      }

      if (persona.avatarUrlThinking) {
        const thinkingPath = path.join(publicDir, persona.avatarUrlThinking);
        expect(fs.existsSync(thinkingPath)).toBe(true);
      }
    }
  });

  it("resolves legacy persona IDs through aliases", () => {
    expect(getPersona("destiny").id).toBe("the-consequentialist");
    expect(getPersona("ben-shapiro").id).toBe("the-logician");
    expect(getPersona("candace").id).toBe("the-contrarian");
    expect(getPersona("andrew-wilson").id).toBe("the-presuppositionalist");
    expect(getPersona("michael-knowles").id).toBe("the-traditionalist");
    expect(getPersona("dave-smith").id).toBe("the-voluntaryist");
  });

  it("resolves new archetype IDs directly", () => {
    expect(getPersona("the-consequentialist").displayName).toBe("The Consequentialist");
    expect(getPersona("the-logician").displayName).toBe("The Logician");
    expect(getPersona("the-contrarian").displayName).toBe("The Contrarian");
    expect(getPersona("the-presuppositionalist").displayName).toBe("The Presuppositionalist");
    expect(getPersona("the-traditionalist").displayName).toBe("The Traditionalist");
    expect(getPersona("the-voluntaryist").displayName).toBe("The Voluntaryist");
  });

  it("returns FALLBACK_PERSONA for invalid or empty IDs", () => {
    expect(getPersona("non-existent-persona")).toEqual(FALLBACK_PERSONA);
    expect(getPersona("")).toEqual(FALLBACK_PERSONA);
  });
});
