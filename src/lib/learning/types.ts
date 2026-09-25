import type { RUBRIC } from "@/lib/debate/rubric";

export type TargetCompetency = keyof typeof RUBRIC;
export type LearningSessionType = "debate" | "drill" | "reassessment";

/** Shared source metadata, inherited by every session through loop_id. */
export interface LearningCycle {
  id: string;
  user_id: string;
  origin_debate_id: string;
  cited_turn_id: string;
  target_competency: TargetCompetency;
  request_id: string;
  created_at: string;
}

interface LearningSessionBase {
  id: string;
  user_id: string;
  loop_id: string;
  request_id: string;
  created_at: string;
}

/** A record is a linked attempt, not evidence of completion or improvement. */
export type LearningSession = LearningSessionBase & (
  | { session_type: "debate"; parent_session_id: null; exercise_template_version: null }
  | { session_type: "drill" | "reassessment"; parent_session_id: string; exercise_template_version: string }
);
