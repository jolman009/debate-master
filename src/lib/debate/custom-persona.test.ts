import { describe, it, expect } from "vitest";
import {
  buildCustomSystemPrompt,
  validateCustomPersonaInput,
  slugifyPersonaName,
  THEME_PRESETS,
  LIMITS,
  CustomPersonaInput,
} from "./custom-persona";

function makeInput(overrides: Partial<CustomPersonaInput> = {}): CustomPersonaInput {
  return {
    displayName: "The Pragmatist",
    tagline: "Outcomes over ideology",
    ideology: "Techno-optimist",
    worldview:
      "Argues from data and real-world outcomes, impatient with vibes-based reasoning.",
    voiceId: "pNInz6obpgDQGcFmaJgB",
    pitch: 1,
    rate: 1,
    theme: THEME_PRESETS[0],
    ...overrides,
  };
}

describe("buildCustomSystemPrompt", () => {
  it("includes the shared rules, the name, and the worldview", () => {
    const out = buildCustomSystemPrompt(makeInput());
    expect(out).toContain("DEBATE FORMAT RULES");
    expect(out).toContain('"The Pragmatist"');
    expect(out).toContain("Argues from data");
  });

  it("appends locked override rules after the description", () => {
    const out = buildCustomSystemPrompt(makeInput());
    expect(out).toContain("ALWAYS override");
    expect(out).toContain("No slurs");
    expect(out).toContain("not a real");
    // the override block comes after the worldview
    expect(out.indexOf("Argues from data")).toBeLessThan(out.indexOf("ALWAYS override"));
  });

  it("includes ideology only when provided", () => {
    expect(buildCustomSystemPrompt(makeInput())).toContain("Techno-optimist");
    expect(buildCustomSystemPrompt(makeInput({ ideology: "" }))).not.toContain(
      "IDEOLOGICAL LEANING"
    );
  });
});

describe("validateCustomPersonaInput", () => {
  it("accepts valid input", () => {
    expect(validateCustomPersonaInput(makeInput())).toEqual({ ok: true });
  });

  it("rejects an empty name", () => {
    const r = validateCustomPersonaInput(makeInput({ displayName: "  " }));
    expect(r.ok).toBe(false);
  });

  it("rejects a name that is too long", () => {
    const r = validateCustomPersonaInput(
      makeInput({ displayName: "x".repeat(LIMITS.displayName + 1) })
    );
    expect(r.ok).toBe(false);
  });

  it("rejects a too-short worldview", () => {
    const r = validateCustomPersonaInput(makeInput({ worldview: "too short" }));
    expect(r.ok).toBe(false);
  });

  it("rejects a too-long worldview", () => {
    const r = validateCustomPersonaInput(
      makeInput({ worldview: "x".repeat(LIMITS.worldviewMax + 1) })
    );
    expect(r.ok).toBe(false);
  });

  it("rejects an out-of-range pitch", () => {
    expect(validateCustomPersonaInput(makeInput({ pitch: 3 })).ok).toBe(false);
  });
});

describe("slugifyPersonaName", () => {
  it("lowercases and hyphenates", () => {
    expect(slugifyPersonaName("The Pragmatist!")).toBe("the-pragmatist");
  });

  it("trims leading/trailing separators", () => {
    expect(slugifyPersonaName("  ?Hello World?  ")).toBe("hello-world");
  });

  it("falls back to 'persona' for empty input", () => {
    expect(slugifyPersonaName("!!!")).toBe("persona");
  });
});
