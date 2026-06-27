import { DebateConfig, DebateStage } from "./types";

export function buildStageSequence(config: DebateConfig): DebateStage[] {
  const stages: DebateStage[] = [
    "setup",
    "opening_user",
    "opening_ai",
    "rebuttal_user_1",
    "rebuttal_ai_1",
  ];

  if (config.rebuttalCycles === 2) {
    stages.push("rebuttal_user_2", "rebuttal_ai_2");
  }

  if (config.crossExamEnabled) {
    stages.push("cross_exam_ai", "cross_exam_user", "cross_exam_ai_response");
  }

  stages.push("closing_user", "closing_ai", "feedback", "complete");

  return stages;
}

export function getNextStage(
  currentStage: DebateStage,
  config: DebateConfig
): DebateStage | null {
  const sequence = buildStageSequence(config);
  const idx = sequence.indexOf(currentStage);
  if (idx === -1 || idx === sequence.length - 1) return null;
  return sequence[idx + 1];
}

type StageActor = "user" | "ai" | "system";

// Explicit per-stage map: the TS Record type forces every DebateStage to be
// classified, so adding a new stage is a compile error until it's handled
// here — no more guessing from name suffixes.
const STAGE_ACTORS: Record<DebateStage, StageActor> = {
  setup: "system",
  opening_user: "user",
  opening_ai: "ai",
  rebuttal_user_1: "user",
  rebuttal_ai_1: "ai",
  rebuttal_user_2: "user",
  rebuttal_ai_2: "ai",
  cross_exam_ai: "ai",
  cross_exam_user: "user",
  cross_exam_ai_response: "ai",
  closing_user: "user",
  closing_ai: "ai",
  feedback: "system",
  complete: "system",
};

export function getStageActor(stage: DebateStage): StageActor {
  return STAGE_ACTORS[stage];
}

export function getStageLabel(stage: DebateStage): string {
  const labels: Record<DebateStage, string> = {
    setup: "Setup",
    opening_user: "Your Opening Statement",
    opening_ai: "Opponent's Opening Statement",
    rebuttal_user_1: "Your Rebuttal (Round 1)",
    rebuttal_ai_1: "Opponent's Rebuttal (Round 1)",
    rebuttal_user_2: "Your Rebuttal (Round 2)",
    rebuttal_ai_2: "Opponent's Rebuttal (Round 2)",
    cross_exam_ai: "Cross-Examination (Questions)",
    cross_exam_user: "Cross-Examination (Your Answers)",
    cross_exam_ai_response: "Cross-Examination (Response)",
    closing_user: "Your Closing Statement",
    closing_ai: "Opponent's Closing Statement",
    feedback: "Debate Feedback",
    complete: "Debate Complete",
  };
  return labels[stage];
}

export function getStageInstruction(stage: DebateStage): string {
  const instructions: Record<DebateStage, string> = {
    setup: "",
    opening_user:
      "Present your opening argument. State your position clearly and outline 2-4 key points.",
    opening_ai: "",
    rebuttal_user_1:
      "Address your opponent's arguments directly. Tag specific points and provide counter-arguments.",
    rebuttal_ai_1: "",
    rebuttal_user_2:
      "Final rebuttal. Strengthen your position and address any remaining counterarguments.",
    rebuttal_ai_2: "",
    cross_exam_ai: "",
    cross_exam_user:
      "Answer the cross-examination questions. Be direct but use your answers to reinforce your position.",
    cross_exam_ai_response: "",
    closing_user:
      "Deliver your closing statement. Summarize your strongest arguments and end persuasively.",
    closing_ai: "",
    feedback: "The debate is over. Review your feedback below.",
    complete: "",
  };
  return instructions[stage];
}

export function isTerminal(stage: DebateStage): boolean {
  return stage === "complete";
}

export function isUserStage(stage: DebateStage): boolean {
  return getStageActor(stage) === "user";
}

export function isAiStage(stage: DebateStage): boolean {
  return getStageActor(stage) === "ai";
}

export function getVisibleStages(config: DebateConfig): DebateStage[] {
  return buildStageSequence(config).filter(
    (s) => s !== "setup" && s !== "complete"
  );
}
