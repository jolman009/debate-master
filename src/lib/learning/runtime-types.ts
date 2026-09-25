import type { TargetedAssessment } from "./assessment";
import type { DrillExercise } from "./drill-templates";
import type { LearningCycle } from "./types";

export type ResponseKind = "initial" | "revision" | "reassessment";
export interface LearningResponse {
  id: string;
  session_id: string;
  request_id: string;
  kind: ResponseKind;
  content: string;
  status: "pending" | "evaluated" | "invalid" | "failed";
  assessment: (TargetedAssessment & { provenance: Record<string, unknown> }) | null;
  attempts: number;
  lease_until: string | null;
}
export interface RuntimeSession {
  session_id: string;
  loop_id: string;
  exercise: DrillExercise;
  state: "ready" | "evaluating" | "coached" | "completed" | "failed";
  draft: string;
  draft_revision: number;
}
export interface CycleView {
  cycle: LearningCycle;
  sessions: RuntimeSession[];
  responses: LearningResponse[];
  enabled: boolean;
}
