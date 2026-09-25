import type { Difficulty } from "@/lib/debate/types";
import type { TargetCompetency } from "./types";

/** Draft curriculum: enable versions only after coach review. */
export const DRILL_TEMPLATES = {
  counterargument: {
    version: "counterargument-response-v1",
    title: "Answer the strongest counterargument",
    competency: "rebuttalQuality" as TargetCompetency,
    instructions: "Restate the opposing argument fairly. Answer its strongest reason, support your answer, and explain which case is stronger.",
    checks: ["Represents the objection accurately", "Answers its strongest reason", "Supports the reply", "Compares the competing cases"],
    retest: "Hypothetical challenge: a school proposes making its library silent all day. An opponent argues that students without quiet study space need silence, even if collaborative groups lose a meeting space. Respond to the opponent's strongest reason and weigh both needs.",
  },
  warrant: {
    version: "claim-evidence-warrant-v1",
    title: "Explain the claim-to-evidence warrant",
    competency: "argumentStrength" as TargetCompetency,
    instructions: "Explain how the supplied evidence supports the claim. State the connecting assumption and one alternative explanation or limit. Treat transcript evidence as unverified, not established fact.",
    checks: ["Connects the evidence to the claim", "Makes an assumption explicit", "Addresses an alternative explanation", "Limits the conclusion appropriately"],
    retest: "Hypothetical challenge: a school claims that longer library hours improve learning. In a fictional four-week pilot, library visits rose, but grades and learning were not measured. Explain the connection, its assumptions, and what the observation cannot establish.",
  },
  repair: {
    version: "unsupported-claim-repair-v1",
    title: "Repair an unsupported claim",
    competency: "evidenceUsage" as TargetCompetency,
    instructions: "Rewrite the claim so its strength matches the support actually available. Explain what remains uncertain and what evidence would be needed. Do not invent a study, statistic or source.",
    checks: ["Identifies the unsupported part", "Qualifies or narrows the claim", "Uses only available support", "Names the remaining evidence gap"],
    retest: "Hypothetical challenge: repair the claim 'Longer library hours improve every student's grades.' Available support: in a fictional four-week pilot, library visits rose; neither grades nor learning were measured. Rewrite the claim and explain what remains unknown.",
  },
} as const;
export type DrillFamily = keyof typeof DRILL_TEMPLATES;
export const FAMILY_ORDER: DrillFamily[] = ["counterargument", "warrant", "repair"];
export const DIFFICULTY_INSTRUCTIONS: Record<Difficulty, string> = {
  beginner: "Use three to five sentences: your answer, your reason, and a limit or comparison.",
  intermediate: "Give a supported answer and address one important assumption or objection.",
  advanced: "Prioritize the decisive issue, test an alternative explanation, and justify the tradeoff.",
};
export const LEARNING_PROMPT_VERSION = "targeted-coach-1";

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
