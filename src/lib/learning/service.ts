import type { SupabaseClient } from "@supabase/supabase-js";
import { GEMINI_MODEL, getGeminiClient } from "@/lib/gemini";
import type { DebateFeedbackV2, DebateTurn, Difficulty } from "@/lib/debate/types";
import { reportError } from "@/lib/observability";
import { approvedTemplateVersions, learningEnabled } from "./flags";
import { recommendDrill } from "./recommendation";
import { assessmentPrompt, assessmentSystem, parseTargetedAssessment } from "./assessment";
import type { CycleView, LearningResponse, ResponseKind, RuntimeSession } from "./runtime-types";
import { RUBRIC_VERSION } from "@/lib/debate/rubric";
import { LEARNING_PROMPT_VERSION } from "./drill-templates";

function supportedExercise(runtime: RuntimeSession): boolean {
  return approvedTemplateVersions().includes(runtime.exercise.templateVersion) &&
    runtime.exercise.rubricVersion === RUBRIC_VERSION && runtime.exercise.promptVersion === LEARNING_PROMPT_VERSION;
}

export class LearningError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function databaseResult<T>(result: { data: T; error: { code?: string } | null }): T {
  if (result.error) {
    const code = result.error.code;
    if (code === "42501") throw new LearningError("Practice session not found.", 404);
    if (code === "P0001") throw new LearningError("Your introductory cycle is already reserved. Resume it to finish your practice.", 403);
    if (code === "22023" || code === "40001" || code === "23505") throw new LearningError("This practice changed. Refresh to resume the saved attempt.", 409);
    if (code === "54000") throw new LearningError("Three evaluation attempts failed. Your work is saved; please contact support.", 409);
    throw new LearningError("Practice could not be saved. Please retry.", 500);
  }
  return result.data;
}
export async function recommendation(db: SupabaseClient, userId: string, debateId: string) {
  const debate = databaseResult(await db.from("debates").select("id,config,current_stage,feedback,assessment_status").eq("id", debateId).eq("user_id", userId).maybeSingle());
  if (!debate) throw new LearningError("Debate not found.", 404);
  const cycles = databaseResult(await db.from("learning_cycles").select("id").eq("user_id", userId).eq("origin_debate_id", debateId).order("created_at"));
  for (const c of cycles ?? []) {
    const runtime = databaseResult(await db.from("learning_runtime").select("session_id").eq("user_id", userId).eq("loop_id", c.id).limit(1));
    if (runtime?.length) return { existingCycleId: c.id as string, recommendation: null };
  }
  if (debate.assessment_status !== "valid" || !["feedback", "complete"].includes(debate.current_stage) || debate.config?.mode === "human" || !debate.feedback) return { existingCycleId: null, recommendation: null };
  const turns = databaseResult(await db.from("debate_turns").select("*").eq("debate_id", debateId).order("created_at"));
  const difficulty: Difficulty = ["beginner", "intermediate", "advanced"].includes(debate.config?.difficulty) ? debate.config.difficulty : "intermediate";
  return { existingCycleId: null, recommendation: recommendDrill(debate.feedback as DebateFeedbackV2, turns as DebateTurn[], difficulty, approvedTemplateVersions(), GEMINI_MODEL) };
}
export async function openCycle(db: SupabaseClient, userId: string, debateId: string, requestId: string): Promise<string> {
  // Check request binding before the resume shortcut.
  const previous = databaseResult(await db.from("learning_cycles").select("id,origin_debate_id").eq("user_id", userId).eq("request_id", requestId).maybeSingle());
  if (previous && previous.origin_debate_id !== debateId) throw new LearningError("Request ID already used for another debate.", 409);
  const source = await recommendation(db, userId, debateId);
  if (source.existingCycleId) return source.existingCycleId;
  if (!source.recommendation) throw new LearningError("No approved drill fits the available transcript evidence yet.", 422);
  const r = source.recommendation;
  return databaseResult(await db.rpc("learning_open", {
    p_user_id: userId, p_origin_debate_id: debateId, p_cited_turn_id: r.citedTurnId,
    p_request_id: requestId, p_exercise: r.exercise, p_reassessment: r.reassessment,
    p_paid_enabled: process.env.LEARNING_PAID_ENABLED === "true",
    p_billing_environment: process.env.LEARNING_BILLING_ENVIRONMENT === "test" ? "test" : "live",
  }));
}
export async function readCycle(db: SupabaseClient, userId: string, cycleId: string): Promise<CycleView> {
  const cycle = databaseResult(await db.from("learning_cycles").select("*").eq("user_id", userId).eq("id", cycleId).maybeSingle());
  if (!cycle) throw new LearningError("Practice cycle not found.", 404);
  const sessions = databaseResult(await db.from("learning_runtime").select("session_id,loop_id,exercise,state,draft,draft_revision").eq("user_id", userId).eq("loop_id", cycleId)) as RuntimeSession[];
  const responses = sessions.length ? databaseResult(await db.from("learning_responses")
    .select("id,session_id,request_id,kind,content,status,assessment,attempts,lease_until").eq("user_id", userId).in("session_id", sessions.map(s => s.session_id)).order("created_at")) as LearningResponse[] : [];
  return { cycle, sessions, responses, enabled: learningEnabled(userId) && sessions.every(supportedExercise) };
}
export async function ownedRuntime(db: SupabaseClient, userId: string, sessionId: string) {
  const runtime = databaseResult(await db.from("learning_runtime").select("*").eq("user_id", userId).eq("session_id", sessionId).maybeSingle()) as RuntimeSession | null;
  if (!runtime) throw new LearningError("Practice session not found.", 404);
  if (!supportedExercise(runtime)) throw new LearningError("This exercise is paused for review. Your work is saved.", 503);
  return runtime;
}

export async function submitResponse(db: SupabaseClient, userId: string, sessionId: string, input: { requestId: string; kind: ResponseKind; content: string; revision: number }) {
  const runtime = await ownedRuntime(db, userId, sessionId);
  const claim = databaseResult(await db.rpc("learning_submit", {
    p_user_id: userId, p_session_id: sessionId, p_request_id: input.requestId,
    p_kind: input.kind, p_content: input.content, p_revision: input.revision,
  })) as { claimed: boolean; response: LearningResponse & { lease_token: string } };
  if (!claim.claimed) return { pending: claim.response.status !== "evaluated" };
  const start = Date.now();
  let outcome = "failed";
  let assessment = null;
  let usage: Record<string, unknown> = { model: runtime.exercise.model, inputTokens: null, outputTokens: null, thinkingTokens: null, totalTokens: null };
  try {
    const result = await getGeminiClient().models.generateContent({
      model: runtime.exercise.model,
      contents: [{ role: "user", parts: [{ text: assessmentPrompt(runtime.exercise, claim.response.content) }] }],
      config: { systemInstruction: assessmentSystem(runtime.exercise), responseMimeType: "application/json", maxOutputTokens: 2500, httpOptions: { timeout: 45000 } },
    });
    usage = { ...usage, inputTokens: result.usageMetadata?.promptTokenCount ?? null,
      outputTokens: result.usageMetadata?.candidatesTokenCount ?? null,
      thinkingTokens: result.usageMetadata?.thoughtsTokenCount ?? null,
      totalTokens: result.usageMetadata?.totalTokenCount ?? null };
    const parsed = parseTargetedAssessment(result.text ?? "", claim.response.content);
    outcome = parsed?.status ?? "invalid";
    if (parsed) assessment = { ...parsed, provenance: {
      model: runtime.exercise.model, rubricVersion: runtime.exercise.rubricVersion,
      promptVersion: runtime.exercise.promptVersion, templateVersion: runtime.exercise.templateVersion,
      difficulty: runtime.exercise.difficulty, sessionFormat: runtime.exercise.kind,
      evaluatedAt: new Date().toISOString(),
    } };
  } catch {
    // Provider errors may include request text. Report only a content-free error.
    reportError(new Error("Learning evaluation failed"), { route: "learning/responses", sessionId });
  }
  const committed = databaseResult(await db.rpc("learning_finish", {
    p_user_id: userId, p_response_id: claim.response.id, p_token: claim.response.lease_token,
    p_assessment: assessment, p_outcome: outcome, p_usage: { ...usage, latencyMs: Date.now() - start },
  }));
  if (outcome === "invalid") reportError(new Error("Invalid targeted assessment"), { route: "learning/responses", sessionId });
  if (!committed) return { pending: true };
  if (!assessment) throw new LearningError("The coach could not evaluate this response. Your answer is saved; retry the evaluation.", 502);
  return { pending: false };
}
