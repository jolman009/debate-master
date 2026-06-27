import { describe, it, expect } from "vitest";
import {
  buildSystemPrompt,
  buildMessages,
  buildFeedbackPrompt,
  FEEDBACK_SYSTEM_PROMPT,
} from "./prompt-builder";
import { Debate, DebateConfig, DebateTurn, Persona } from "./types";

function makeConfig(overrides: Partial<DebateConfig> = {}): DebateConfig {
  return {
    topic: "Climate policy",
    motion: "This house would tax carbon",
    userSide: "pro",
    personaId: "destiny",
    difficulty: "intermediate",
    rebuttalCycles: 1,
    crossExamEnabled: false,
    ...overrides,
  };
}

const persona = { systemPrompt: "PERSONA_SYSTEM_PROMPT" } as unknown as Persona;

function makeDebate(config: DebateConfig): Debate {
  return { config } as unknown as Debate;
}

function makeTurn(
  stage: DebateTurn["stage"],
  role: DebateTurn["role"],
  content: string
): DebateTurn {
  return {
    id: `${stage}-${role}`,
    debate_id: "d1",
    stage,
    role,
    content,
    created_at: "2026-01-01T00:00:00Z",
  };
}

describe("buildSystemPrompt", () => {
  it("includes the persona prompt, topic and motion", () => {
    const out = buildSystemPrompt(persona, makeDebate(makeConfig()));
    expect(out).toContain("PERSONA_SYSTEM_PROMPT");
    expect(out).toContain("Climate policy");
    expect(out).toContain("This house would tax carbon");
  });

  it("assigns the AI the opposite side of the user", () => {
    const proUser = buildSystemPrompt(persona, makeDebate(makeConfig({ userSide: "pro" })));
    expect(proUser).toContain("Your side: Con (Against)");
    expect(proUser).toContain("Opponent's side: Pro (For)");

    const conUser = buildSystemPrompt(persona, makeDebate(makeConfig({ userSide: "con" })));
    expect(conUser).toContain("Your side: Pro (For)");
  });

  it("adds difficulty-specific guidance only for beginner/advanced", () => {
    const beginner = buildSystemPrompt(persona, makeDebate(makeConfig({ difficulty: "beginner" })));
    expect(beginner).toContain("more accessible");

    const advanced = buildSystemPrompt(persona, makeDebate(makeConfig({ difficulty: "advanced" })));
    expect(advanced).toContain("most sophisticated");

    const intermediate = buildSystemPrompt(persona, makeDebate(makeConfig({ difficulty: "intermediate" })));
    expect(intermediate).not.toContain("more accessible");
    expect(intermediate).not.toContain("most sophisticated");
  });
});

describe("buildMessages", () => {
  it("emits a single labelled user message for fresh user content", () => {
    const msgs = buildMessages([], "opening_user", "My opening");
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe("user");
    expect(msgs[0].content).toContain("[Your Opening Statement]");
    expect(msgs[0].content).toContain("My opening");
  });

  it("maps ai turns to assistant and user turns to user", () => {
    const msgs = buildMessages(
      [
        makeTurn("opening_user", "user", "U opening"),
        makeTurn("opening_ai", "ai", "AI opening"),
      ],
      "rebuttal_user_1",
      "U rebuttal"
    );
    expect(msgs[0].role).toBe("user");
    expect(msgs[1].role).toBe("assistant");
    expect(msgs[1].content).toContain("AI opening");
  });

  it("prepends a user primer when the history starts with an assistant turn", () => {
    const msgs = buildMessages(
      [makeTurn("opening_ai", "ai", "AI opening")],
      "opening_ai"
    );
    expect(msgs[0].role).toBe("user");
  });

  it("injects the AI stage instruction when there is no user content", () => {
    const msgs = buildMessages(
      [makeTurn("opening_user", "user", "U opening")],
      "opening_ai"
    );
    const last = msgs[msgs.length - 1];
    expect(last.role).toBe("user");
    expect(last.content).toContain("Stage instruction");
  });

  it("merges consecutive same-role messages", () => {
    const msgs = buildMessages(
      [
        makeTurn("opening_user", "user", "first"),
        makeTurn("rebuttal_user_1", "user", "second"),
      ],
      "rebuttal_ai_1"
    );
    // both user turns + the injected instruction collapse into one user message
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toContain("first");
    expect(msgs[0].content).toContain("second");
  });

  it("always starts with a user message (Anthropic requirement)", () => {
    const msgs = buildMessages(
      [makeTurn("opening_ai", "ai", "AI opening")],
      "rebuttal_user_1",
      "U rebuttal"
    );
    expect(msgs[0].role).toBe("user");
  });
});

describe("buildFeedbackPrompt", () => {
  it("renders a labelled transcript of all turns", () => {
    const out = buildFeedbackPrompt([
      makeTurn("opening_user", "user", "user said"),
      makeTurn("opening_ai", "ai", "ai said"),
    ]);
    expect(out).toContain("DEBATE TRANSCRIPT");
    expect(out).toContain("USER");
    expect(out).toContain("AI OPPONENT");
    expect(out).toContain("user said");
    expect(out).toContain("ai said");
  });
});

describe("FEEDBACK_SYSTEM_PROMPT", () => {
  it("names every scoring dimension and asks for JSON", () => {
    for (const key of [
      "overallScore",
      "argumentStrength",
      "evidenceUsage",
      "rebuttalQuality",
      "rhetoricalSkill",
      "summary",
      "strengths",
      "improvements",
    ]) {
      expect(FEEDBACK_SYSTEM_PROMPT).toContain(key);
    }
    expect(FEEDBACK_SYSTEM_PROMPT).toContain("JSON");
  });
});
