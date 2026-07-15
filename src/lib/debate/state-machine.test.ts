import { describe, it, expect } from "vitest";
import {
  buildStageSequence,
  getNextStage,
  getStageActor,
  getStageActorInfo,
  getActiveSide,
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

describe("human mode", () => {
  const humanCfg = (overrides: Partial<DebateConfig> = {}) =>
    makeConfig({ mode: "human", ...overrides });

  it("builds a side-named sequence that starts with pro and ends at judge", () => {
    expect(buildStageSequence(humanCfg())).toEqual([
      "setup",
      "opening_pro",
      "opening_con",
      "rebuttal_pro_1",
      "rebuttal_con_1",
      "closing_pro",
      "closing_con",
      "judge",
      "complete",
    ]);
  });

  it("adds side-named rebuttal and cross-exam stages when configured", () => {
    const seq = buildStageSequence(
      humanCfg({ rebuttalCycles: 2, crossExamEnabled: true })
    );
    expect(seq).toEqual(
      expect.arrayContaining([
        "rebuttal_pro_2",
        "rebuttal_con_2",
        "cross_exam_pro",
        "cross_exam_con",
      ])
    );
    // cross-exam sits after rebuttals, before closing
    expect(seq.indexOf("cross_exam_pro")).toBeLessThan(
      seq.indexOf("closing_pro")
    );
  });

  it("advances pro → con → pro across the debate", () => {
    const cfg = humanCfg();
    expect(getNextStage("opening_pro", cfg)).toBe("opening_con");
    expect(getNextStage("opening_con", cfg)).toBe("rebuttal_pro_1");
    expect(getNextStage("rebuttal_con_1", cfg)).toBe("closing_pro");
    expect(getNextStage("closing_con", cfg)).toBe("judge");
  });

  it("resolves the active side per stage (human stages carry it intrinsically)", () => {
    const cfg = humanCfg();
    expect(getActiveSide("opening_pro", cfg)).toBe("pro");
    expect(getActiveSide("opening_con", cfg)).toBe("con");
    expect(getActiveSide("closing_pro", cfg)).toBe("pro");
    // system stages have no active side
    expect(getActiveSide("judge", cfg)).toBeNull();
    expect(getActiveSide("complete", cfg)).toBeNull();
    expect(getActiveSide("setup", cfg)).toBeNull();
  });

  it("derives the active side from userSide for AI-mode stages", () => {
    const proUser = makeConfig({ userSide: "pro" });
    expect(getActiveSide("opening_user", proUser)).toBe("pro");
    expect(getActiveSide("opening_ai", proUser)).toBe("con");
    const conUser = makeConfig({ userSide: "con" });
    expect(getActiveSide("opening_user", conUser)).toBe("con");
    expect(getActiveSide("opening_ai", conUser)).toBe("pro");
  });

  it("classifies human debater stages as human turns, judge as system", () => {
    expect(getStageActorInfo("opening_pro")).toEqual({
      kind: "human",
      side: "pro",
    });
    expect(getStageActor("opening_pro")).toBe("user");
    expect(isAiStage("opening_con")).toBe(false);
    expect(getStageActor("judge")).toBe("system");
  });

  it("shows judge (not feedback) as a visible stage in human mode", () => {
    const visible = getVisibleStages(humanCfg());
    expect(visible).toContain("judge");
    expect(visible).not.toContain("feedback");
    expect(visible).not.toContain("complete");
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
    "opening_pro",
    "opening_con",
    "rebuttal_pro_1",
    "rebuttal_con_1",
    "rebuttal_pro_2",
    "rebuttal_con_2",
    "cross_exam_pro",
    "cross_exam_con",
    "closing_pro",
    "closing_con",
    "judge",
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
