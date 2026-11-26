import type { Difficulty } from "@/lib/debate/types";
import type { TargetCompetency } from "./types";

/** Draft curriculum: enable versions only after coach review. */
export const DRILL_TEMPLATES = {
  counterargument: {
    version: "counterargument-response-v2",
    title: "Answer the strongest counterargument",
    competency: "rebuttalQuality" as TargetCompetency,
    instructions: "Restate the opposing argument fairly. Answer its strongest reason, support your answer, and explain which case is stronger. You may concede a valid point while explaining why your broader position still holds.",
    checks: ["Represents the objection accurately", "Answers its strongest reason", "Supports the reply", "Compares the competing cases"],
    retest: "Hypothetical challenge: a school proposes making its library silent all day. An opponent argues that students without quiet study space need silence, even if collaborative groups lose a meeting space. Respond to the opponent's strongest reason and weigh both needs.",
  },
  warrant: {
    version: "claim-evidence-warrant-v2",
    title: "Explain the claim-to-evidence warrant",
    competency: "argumentStrength" as TargetCompetency,
    instructions: "Explain whether—and how—the supplied evidence supports the claim. Identify the connecting assumption. If the evidence does not support the claim, explain the gap. Discuss one alternative explanation or limitation. Treat transcript evidence as unverified, not established fact.",
    checks: ["Explains the connection or identifies why it fails", "Makes an assumption explicit", "Addresses an alternative explanation", "Limits the conclusion appropriately"],
    retest: "Hypothetical challenge: a school claims that longer library hours improve learning. In a fictional four-week pilot, library visits rose, but grades and learning were not measured. Explain the connection, its assumptions, and what the observation cannot establish.",
  },
  repair: {
    version: "unsupported-claim-repair-v2",
    title: "Repair an unsupported claim",
    competency: "evidenceUsage" as TargetCompetency,
    instructions: "Narrow, qualify, or withdraw the claim so its strength matches the supplied evidence card. Explain why your change follows from that evidence; merely adding might or may is not enough. Explain what remains uncertain and what evidence would be needed. Do not invent a study, statistic or source.",
    checks: ["Identifies the unsupported part", "Justifies narrowing, qualifying, or withdrawing the claim", "Uses only available support", "Names the remaining evidence gap"],
    retest: "Hypothetical challenge: repair the claim 'New recycling bins eliminate waste throughout the school.' Fictional evidence card: during a two-week trial in one cafeteria, separately collected recyclable material increased. Total waste, sorting accuracy, and other buildings were not measured. Narrow, qualify, or withdraw the claim and justify your decision using only this card.",
  },
} as const;
export type DrillFamily = keyof typeof DRILL_TEMPLATES;
export const FAMILY_ORDER: DrillFamily[] = ["counterargument", "warrant", "repair"];
export const DIFFICULTY_INSTRUCTIONS: Record<DrillFamily, Record<Difficulty, string>> = {
  counterargument: {
    beginner: "Use three to five sentences: restate the objection, answer its reason, and compare the two positions.",
    intermediate: "Support your reply and explain how any valid concession affects your position.",
    advanced: "Identify the decisive objection, concede what survives scrutiny, and justify which competing consideration carries more weight.",
  },
  warrant: {
    beginner: "Use three to five sentences: identify the claim and observation, explain the proposed link, and name one limit.",
    intermediate: "Explain the connecting assumption and one alternative explanation, or why no defensible connection exists.",
    advanced: "Test the inference against an alternative explanation and specify what additional observation would distinguish them. Limit the conclusion accordingly.",
  },
  repair: {
    beginner: "Write a revised claim, point to the observation supporting it, and name one thing the evidence does not show.",
    intermediate: "Explain which scope or certainty you changed and why the evidence requires that change.",
    advanced: "Distinguish measured outcomes from unmeasured ones, justify the remaining scope and certainty, and specify evidence needed for a stronger claim.",
  },
};
export const REPAIR_PRACTICE_CARD = "Separate hypothetical practice task: the transcript excerpt identifies the skill to practice; the following card is not evidence about your original debate. Claim: 'More frequent buses eliminate lateness for all commuters.' Fictional evidence card: on one bus route during a one-week trial, recorded average waiting time fell from 12 to 8 minutes. Arrival times at work, other routes, and longer-term results were not measured. Repair this supplied claim using only this card.";
export const LEARNING_PROMPT_VERSION = "targeted-coach-2";

export interface ExerciseReference { turnId: string; excerpt: string; role: "user" | "ai" }
export interface DrillExercise {
  family: DrillFamily;
  templateVersion: string;
  title: string;
  competency: TargetCompetency;
  difficulty: Difficulty;
  instructions: string;
  context: string;
  references: ExerciseReference[];
  checks: readonly string[];
  rubricVersion: string;
  promptVersion: string;
  model: string;
  kind: "drill" | "reassessment";
}
