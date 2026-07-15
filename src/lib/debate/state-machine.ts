import { DebateConfig, DebateStage, Side } from "./types";

export function isHumanMode(config: DebateConfig): boolean {
  return config.mode === "human";
}

// AI-mode sequence: one human (the user) versus the AI persona. Unchanged.
function buildAiSequence(config: DebateConfig): DebateStage[] {
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

// Human-mode sequence: two humans, side-named stages. Pro always opens, and a
// neutral AI `judge` terminal replaces the one-sided `feedback` stage.
function buildHumanSequence(config: DebateConfig): DebateStage[] {
  const stages: DebateStage[] = [
    "setup",
    "opening_pro",
    "opening_con",
    "rebuttal_pro_1",
    "rebuttal_con_1",
  ];

  if (config.rebuttalCycles === 2) {
    stages.push("rebuttal_pro_2", "rebuttal_con_2");
  }

  if (config.crossExamEnabled) {
    stages.push("cross_exam_pro", "cross_exam_con");
  }

  stages.push("closing_pro", "closing_con", "judge", "complete");

  return stages;
}

export function buildStageSequence(config: DebateConfig): DebateStage[] {
  return isHumanMode(config)
    ? buildHumanSequence(config)
    : buildAiSequence(config);
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

// D4 — side-aware actor resolution. `kind` says who acts; `side` is intrinsic
// only for human-mode stages (which are named by side). AI-mode user/ai stages
// carry no static side — it's derived from config.userSide by getActiveSide().
type StageActor = "user" | "ai" | "system";

export interface StageActorInfo {
  kind: "human" | "ai" | "system";
  side?: Side;
}

// The canonical per-stage classification. The Record type forces every
// DebateStage to be handled here, so adding a stage is a compile error until
// it's classified — no guessing from name suffixes.
const STAGE_ACTOR_INFO: Record<DebateStage, StageActorInfo> = {
  // AI mode
  setup: { kind: "system" },
  opening_user: { kind: "human" },
  opening_ai: { kind: "ai" },
  rebuttal_user_1: { kind: "human" },
  rebuttal_ai_1: { kind: "ai" },
  rebuttal_user_2: { kind: "human" },
  rebuttal_ai_2: { kind: "ai" },
  cross_exam_ai: { kind: "ai" },
  cross_exam_user: { kind: "human" },
  cross_exam_ai_response: { kind: "ai" },
  closing_user: { kind: "human" },
  closing_ai: { kind: "ai" },
  feedback: { kind: "system" },
  // Human mode
  opening_pro: { kind: "human", side: "pro" },
  opening_con: { kind: "human", side: "con" },
  rebuttal_pro_1: { kind: "human", side: "pro" },
  rebuttal_con_1: { kind: "human", side: "con" },
  rebuttal_pro_2: { kind: "human", side: "pro" },
  rebuttal_con_2: { kind: "human", side: "con" },
  cross_exam_pro: { kind: "human", side: "pro" },
  cross_exam_con: { kind: "human", side: "con" },
  closing_pro: { kind: "human", side: "pro" },
  closing_con: { kind: "human", side: "con" },
  judge: { kind: "system" },
  complete: { kind: "system" },
};

export function getStageActorInfo(stage: DebateStage): StageActorInfo {
  return STAGE_ACTOR_INFO[stage];
}

// Backward-compatible simple actor. A human debater (either the AI-mode user or
// a human-mode side) reads as "user"; the AI persona as "ai".
export function getStageActor(stage: DebateStage): StageActor {
  const kind = STAGE_ACTOR_INFO[stage].kind;
  return kind === "human" ? "user" : kind;
}

/**
 * Which side is acting at `stage`, or null for system stages (setup, feedback,
 * judge, complete). For human stages the side is intrinsic; for AI-mode stages
 * it derives from the user's chosen side.
 */
export function getActiveSide(
  stage: DebateStage,
  config: DebateConfig
): Side | null {
  const info = STAGE_ACTOR_INFO[stage];
  if (info.kind === "system") return null;
  if (info.side) return info.side;
  const userSide = config.userSide;
  const opponentSide: Side = userSide === "pro" ? "con" : "pro";
  return info.kind === "human" ? userSide : opponentSide;
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
    // Human mode
    opening_pro: "Pro — Opening Statement",
    opening_con: "Con — Opening Statement",
    rebuttal_pro_1: "Pro — Rebuttal (Round 1)",
    rebuttal_con_1: "Con — Rebuttal (Round 1)",
    rebuttal_pro_2: "Pro — Rebuttal (Round 2)",
    rebuttal_con_2: "Con — Rebuttal (Round 2)",
    cross_exam_pro: "Pro — Cross-Examination",
    cross_exam_con: "Con — Cross-Examination",
    closing_pro: "Pro — Closing Statement",
    closing_con: "Con — Closing Statement",
    judge: "The Judge's Verdict",
    complete: "Debate Complete",
  };
  return labels[stage];
}

export function getStageInstruction(stage: DebateStage): string {
  const openingInstruction =
    "Present your opening argument. State your position clearly and outline 2-4 key points.";
  const rebuttalInstruction =
    "Address your opponent's arguments directly. Tag specific points and provide counter-arguments.";
  const crossExamInstruction =
    "Pose sharp cross-examination questions, then use them to expose weaknesses in your opponent's case.";
  const closingInstruction =
    "Deliver your closing statement. Summarize your strongest arguments and end persuasively.";

  const instructions: Record<DebateStage, string> = {
    setup: "",
    opening_user: openingInstruction,
    opening_ai: "",
    rebuttal_user_1: rebuttalInstruction,
    rebuttal_ai_1: "",
    rebuttal_user_2:
      "Final rebuttal. Strengthen your position and address any remaining counterarguments.",
    rebuttal_ai_2: "",
    cross_exam_ai: "",
    cross_exam_user:
      "Answer the cross-examination questions. Be direct but use your answers to reinforce your position.",
    cross_exam_ai_response: "",
    closing_user: closingInstruction,
    closing_ai: "",
    feedback: "The debate is over. Review your feedback below.",
    // Human mode — the active side is prompted; the waiting side sees no input.
    opening_pro: openingInstruction,
    opening_con: openingInstruction,
    rebuttal_pro_1: rebuttalInstruction,
    rebuttal_con_1: rebuttalInstruction,
    rebuttal_pro_2: rebuttalInstruction,
    rebuttal_con_2: rebuttalInstruction,
    cross_exam_pro: crossExamInstruction,
    cross_exam_con: crossExamInstruction,
    closing_pro: closingInstruction,
    closing_con: closingInstruction,
    judge: "Both sides have finished. The judge will now decide the winner.",
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
