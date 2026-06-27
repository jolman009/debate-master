import { describe, it, expect } from "vitest";
import {
  buildStageSequence,
  getNextStage,
  getStageActor,
  getStageLabel,
  getStageInstruction,
  isTerminal,
  isUserStage,
  isAiStage,
  getVisibleStages,
} from "./state-machine";
import { DebateConfig, DebateStage } from "./types";

function makeConfig(overrides: Partial<DebateConfig> = {}): DebateConfig {
  return {
    topic: "Topic",
    motion: "This house believes X",
    userSide: "pro",
    personaId: "destiny",
    difficulty: "intermediate",
    rebuttalCycles: 1,
    crossExamEnabled: false,
    ...overrides,
  };
}

describe("buildStageSequence", () => {
  it("builds the minimal sequence (1 cycle, no cross-exam)", () => {
    expect(buildStageSequence(makeConfig())).toEqual([
      "setup",
      "opening_user",
      "opening_ai",
      "rebuttal_user_1",
      "rebuttal_ai_1",
      "closing_user",
      "closing_ai",
      "feedback",
      "complete",
    ]);
  });

  it("adds a second rebuttal cycle when configured", () => {
    const seq = buildStageSequence(makeConfig({ rebuttalCycles: 2 }));
    expect(seq).toContain("rebuttal_user_2");
    expect(seq).toContain("rebuttal_ai_2");
    expect(seq.indexOf("rebuttal_ai_1")).toBeLessThan(
      seq.indexOf("rebuttal_user_2")
    );
  });

  it("inserts cross-examination stages when enabled", () => {
    const seq = buildStageSequence(makeConfig({ crossExamEnabled: true }));
    expect(seq).toEqual(
      expect.arrayContaining([
        "cross_exam_ai",
        "cross_exam_user",
        "cross_exam_ai_response",
      ])
    );
    // cross-exam comes after rebuttals, before closing
    expect(seq.indexOf("cross_exam_ai")).toBeLessThan(
      seq.indexOf("closing_user")
    );
  });

  it("always ends with feedback then complete", () => {
    const seq = buildStageSequence(
      makeConfig({ rebuttalCycles: 2, crossExamEnabled: true })
    );
    expect(seq.slice(-2)).toEqual(["feedback", "complete"]);
  });
});

describe("getNextStage", () => {
  it("advances to the next stage in sequence", () => {
    const cfg = makeConfig();
    expect(getNextStage("opening_user", cfg)).toBe("opening_ai");
    expect(getNextStage("rebuttal_ai_1", cfg)).toBe("closing_user");
  });

  it("returns null at the terminal stage", () => {
    expect(getNextStage("complete", makeConfig())).toBeNull();
  });

  it("returns null for a stage not present in the sequence", () => {
    // rebuttal_user_2 is absent from a 1-cycle debate
    expect(getNextStage("rebuttal_user_2", makeConfig())).toBeNull();
  });
});

describe("stage actor helpers", () => {
  it("classifies actors correctly", () => {
    expect(getStageActor("opening_user")).toBe("user");
    expect(getStageActor("opening_ai")).toBe("ai");
    expect(getStageActor("setup")).toBe("system");
    expect(getStageActor("feedback")).toBe("system");
  });

  it("isUserStage / isAiStage agree with the actor map", () => {
    expect(isUserStage("closing_user")).toBe(true);
    expect(isUserStage("closing_ai")).toBe(false);
    expect(isAiStage("cross_exam_ai")).toBe(true);
    expect(isAiStage("cross_exam_user")).toBe(false);
  });
});

describe("isTerminal", () => {
  it("is true only for complete", () => {
    expect(isTerminal("complete")).toBe(true);
    expect(isTerminal("feedback")).toBe(false);
  });
});

describe("getVisibleStages", () => {
  it("excludes setup and complete", () => {
    const visible = getVisibleStages(makeConfig());
    expect(visible).not.toContain("setup");
    expect(visible).not.toContain("complete");
    expect(visible).toContain("opening_user");
  });
});

describe("labels and instructions", () => {
  const allStages: DebateStage[] = [
    "setup",
    "opening_user",
    "opening_ai",
    "rebuttal_user_1",
    "rebuttal_ai_1",
    "rebuttal_user_2",
    "rebuttal_ai_2",
    "cross_exam_ai",
    "cross_exam_user",
    "cross_exam_ai_response",
    "closing_user",
    "closing_ai",
    "feedback",
    "complete",
  ];

  it("returns a non-empty label for every stage", () => {
    for (const stage of allStages) {
      expect(getStageLabel(stage).length).toBeGreaterThan(0);
    }
  });

  it("returns a string instruction for every stage (some empty)", () => {
    for (const stage of allStages) {
      expect(typeof getStageInstruction(stage)).toBe("string");
    }
    expect(getStageInstruction("opening_user").length).toBeGreaterThan(0);
  });
});
