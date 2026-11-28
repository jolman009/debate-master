/**
 * G1-3.4 cycle audit: for real staging practice cycles, check that
 *  - every quote the drill shows is an exact excerpt of the source debate turn,
 *  - every excerpt the coach cites is an exact substring of the learner's answer,
 *  - each assessment scores only the targeted skill (no overall or other-skill score),
 *  - provenance (model, rubric/prompt/template version) is recorded and matches the session,
 *  - "insufficient" assessments have a null score and "valid" ones an integer 1–10.
 * It also counts lifecycle events (G1-3.8) and evaluation attempts/token usage (G1-3.9).
 * Read-only and content-free: prints ids, statuses, counts and versions, never debate,
 * response or coaching text.
 *
 *   STAGING_SUPABASE_URL=... STAGING_SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx --yes tsx scripts/audit-learning-cycles.mts <cycleId> [<cycleId> ...] [--out report.json]
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";

type Ref = { turnId: string; excerpt: string; role?: string };
type Exercise = { family?: string; templateVersion?: string; competency?: string; references?: Ref[] };
type Assessment = Record<string, unknown> & {
  status?: string; score?: unknown; excerpts?: unknown;
  provenance?: { model?: string; rubricVersion?: string; promptVersion?: string; templateVersion?: string; sessionFormat?: string };
};

const ASSESSMENT_KEYS = new Set(["status", "score", "rationale", "strength", "correction", "retryInstruction", "excerpts", "provenance"]);
const arg = (name: string) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const out = arg("--out");
const cycleIds = process.argv.slice(2).filter((a, i, all) => !a.startsWith("--") && all[i - 1] !== "--out");
if (!cycleIds.length) throw new Error("Pass one or more cycle ids");

const url = process.env.STAGING_SUPABASE_URL, key = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
if (url !== "https://twtsdothnlfvbczzpdaj.supabase.co" || !key) throw new Error("Known staging URL and service key required");
const db = createClient(url, key, { auth: { persistSession: false } });
const must = <T,>(r: { data: T | null; error: { code?: string } | null }, label: string): T => {
  if (r.error) throw new Error(`${label} failed: ${r.error.code ?? "error"}`);
  return r.data as T;
};

function checkAssessment(a: Assessment | null, content: string, sessionTemplate: string | null) {
  if (!a) return { present: false };
  const extraKeys = Object.keys(a).filter(k => !ASSESSMENT_KEYS.has(k));
  const excerpts = Array.isArray(a.excerpts) ? a.excerpts as unknown[] : [];
  const exact = excerpts.filter(e => typeof e === "string" && e.trim() && content.includes(e)).length;
  const scoreOk = a.status === "valid"
    ? typeof a.score === "number" && Number.isInteger(a.score) && a.score >= 1 && a.score <= 10
    : a.status === "insufficient" ? a.score === null : false;
  const p = a.provenance ?? {};
  return {
    present: true,
    status: a.status,
    scoreShape: scoreOk ? (a.status === "valid" ? "integer_1_10" : "null") : "WRONG",
    targetedOnly: extraKeys.length === 0,
    extraKeys,
    excerpts: { total: excerpts.length, exact },
    provenance: {
      model: p.model ?? "MISSING", rubricVersion: p.rubricVersion ?? "MISSING",
      promptVersion: p.promptVersion ?? "MISSING", templateVersion: p.templateVersion ?? "MISSING",
      matchesSession: !!sessionTemplate && p.templateVersion === sessionTemplate,
    },
  };
}

const report: Record<string, unknown>[] = [];
for (const cycleId of cycleIds) {
  const cycle = must(await db.from("learning_cycles").select("id,user_id,origin_debate_id,target_competency,created_at").eq("id", cycleId).maybeSingle(), "Cycle");
  if (!cycle) { report.push({ cycleId, found: false }); continue; }
  const c = cycle as { id: string; user_id: string; origin_debate_id: string; target_competency: string; created_at: string };
  const sessions = must(await db.from("learning_sessions").select("id,session_type,exercise_template_version,created_at").eq("loop_id", c.id).order("created_at"), "Sessions") as
    { id: string; session_type: string; exercise_template_version: string | null }[];
  const sessionIds = sessions.map(s => s.id);
  const runtime = sessionIds.length ? must(await db.from("learning_runtime").select("session_id,exercise,reassessment_exercise,state").in("session_id", sessionIds), "Runtime") as
    { session_id: string; exercise: Exercise; reassessment_exercise: Exercise | null; state: string }[] : [];
  const responses = sessionIds.length ? must(await db.from("learning_responses").select("id,session_id,kind,status,content,assessment,attempts,attempt_limit").in("session_id", sessionIds).order("created_at"), "Responses") as
    { id: string; session_id: string; kind: string; status: string; content: string; assessment: Assessment | null; attempts: number; attempt_limit: number }[] : [];
  const evals = responses.length ? must(await db.from("learning_evaluations").select("response_id,outcome,usage,started_at,finished_at").in("response_id", responses.map(r => r.id)), "Evaluations") as
    { response_id: string; outcome: string; usage: Record<string, unknown> | null; started_at: string; finished_at: string | null }[] : [];
  const events = must(await db.from("learning_events").select("event_name,session_id").eq("loop_id", c.id), "Events") as { event_name: string; session_id: string }[];
  const turns = must(await db.from("debate_turns").select("id,role,content").eq("debate_id", c.origin_debate_id), "Turns") as { id: string; role: string; content: string }[];
  const turnById = new Map(turns.map(t => [t.id, t]));

  // Drill quotes must be exact excerpts of the turn they point to.
  const refs = runtime.flatMap(r => [...(r.exercise?.references ?? []), ...(r.reassessment_exercise?.references ?? [])]);
  const refChecks = refs.map(r => {
    const t = turnById.get(r.turnId);
    return { role: r.role ?? "?", turnFound: !!t, roleMatches: !!t && (!r.role || r.role === t.role || (r.role === "ai" && t.role !== "user")),
      exact: !!t && typeof r.excerpt === "string" && r.excerpt.trim().length > 0 && t.content.includes(r.excerpt) };
  });

  const templateBySession = new Map(sessions.map(s => [s.id, s.exercise_template_version]));
  const responseChecks = responses.map(r => {
    const attempts = evals.filter(e => e.response_id === r.id);
    const tokensKnown = attempts.filter(e => typeof e.usage?.totalTokens === "number").length;
    return {
      kind: r.kind, status: r.status, attempts: `${r.attempts}/${r.attempt_limit}`,
      evaluationOutcomes: attempts.reduce<Record<string, number>>((m, e) => (m[e.outcome] = (m[e.outcome] ?? 0) + 1, m), {}),
      usage: { attempts: attempts.length, tokensKnown, tokensUnknown: attempts.length - tokensKnown,
        latencyMsRecorded: attempts.filter(e => typeof e.usage?.latencyMs === "number").length },
      assessment: checkAssessment(r.assessment, r.content, templateBySession.get(r.session_id) ?? null),
    };
  });

  const eventCounts = events.reduce<Record<string, number>>((m, e) => (m[e.event_name] = (m[e.event_name] ?? 0) + 1, m), {});
  const evaluated = responseChecks.filter(r => r.assessment.present);
  const checks = {
    drillQuotesExact: refChecks.length > 0 && refChecks.every(r => r.turnFound && r.exact),
    coachExcerptsExact: evaluated.every(r => r.assessment.present && r.assessment.excerpts!.exact === r.assessment.excerpts!.total),
    targetedOnlyNoOverall: evaluated.every(r => r.assessment.present && r.assessment.targetedOnly),
    scoreShapeCorrect: evaluated.every(r => r.assessment.present && r.assessment.scoreShape !== "WRONG"),
    provenanceComplete: evaluated.every(r => r.assessment.present && Object.values(r.assessment.provenance!).every(v => v !== "MISSING") && r.assessment.provenance!.matchesSession),
    oneCompletionPerAction: ["drill_completed", "reassessment_completed", "cycle_completed"].every(n => (eventCounts[n] ?? 0) <= 1),
  };
  report.push({
    cycleId: c.id, found: true, targetCompetency: c.target_competency, createdAt: c.created_at,
    sessions: sessions.map(s => ({ type: s.session_type, template: s.exercise_template_version })),
    runtimeStates: runtime.map(r => r.state),
    drillQuotes: refChecks, responses: responseChecks, events: eventCounts,
    insufficientSeen: evaluated.some(r => r.assessment.present && r.assessment.status === "insufficient"),
    checks, passed: Object.values(checks).every(Boolean),
  });
}

const result = { checkedAt: new Date().toISOString(), cycles: report };
if (out) writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
