import { isValidAssessment } from "@/lib/debate/feedback";
import type { DebateFeedbackV2, DebateTurn, Difficulty } from "@/lib/debate/types";
import { RUBRIC_VERSION } from "@/lib/debate/rubric";
import { REPAIR_PRACTICE_CARD, DIFFICULTY_INSTRUCTIONS, DRILL_TEMPLATES, FAMILY_ORDER, LEARNING_PROMPT_VERSION, type DrillExercise, type DrillFamily, type ExerciseReference } from "./drill-templates";

export type RoutingStatus =
  | "eligible"
  | "not_approved"
  | "no_learner_excerpt"
  | "no_cited_opposing_excerpt"
  | "no_distinct_evidence_excerpt";

type FamilyRoute = { family: DrillFamily; status: RoutingStatus; references: ExerciseReference[]; context: string };

/** Whether feedback passes the shared gates (v2, complete rubric, valid scores). */
export function routableFeedback(feedback: DebateFeedbackV2): boolean {
  return feedback.version === 2 && !!feedback.rubric &&
    ["argumentStrength", "evidenceUsage", "rebuttalQuality", "rhetoricalSkill"].every(k =>
      feedback.rubric[k as keyof typeof feedback.rubric] && Array.isArray(feedback.rubric[k as keyof typeof feedback.rubric].evidence)) &&
    isValidAssessment(feedback);
}

function routeFamily(family: DrillFamily, feedback: DebateFeedbackV2, turns: DebateTurn[]): FamilyRoute {
  const template = DRILL_TEMPLATES[family];
  const references: ExerciseReference[] = (feedback.rubric[template.competency].evidence ?? []).flatMap(e => {
    const turn = turns.find(t => t.id === e.turnId && t.role === "user");
    return turn && typeof e?.excerpt === "string" && e.excerpt.trim() && e.excerpt.length <= 2000 && turn.content.includes(e.excerpt)
      ? [{ turnId: turn.id, excerpt: e.excerpt, role: "user" as const }] : [];
  });
  if (!references.length) return { family, status: "no_learner_excerpt", references: [], context: "" };
  const source = references[0];
  if (family === "counterargument") {
    // Require both sides to be cited by the same coaching dimension, and the
    // opposing quote to come before the learner quote it is paired with. Mere
    // chronological adjacency does not establish an argumentative connection.
    // Any cited learner quote may be the response (e.g. a cited opening that
    // precedes the AI turn must not hide a later cited rebuttal).
    for (const learner of references) {
      const index = turns.findIndex(t => t.id === learner.turnId);
      const opponentRef = feedback.rubric.rebuttalQuality.evidence.find(e =>
        typeof e?.excerpt === "string" && e.excerpt.trim() && e.excerpt.length <= 6000 &&
        turns.slice(0, index).some(t => t.id === e.turnId && t.role === "ai" && t.content.includes(e.excerpt)));
      if (opponentRef) return { family, status: "eligible", references: [learner, { turnId: opponentRef.turnId, excerpt: opponentRef.excerpt, role: "ai" }],
        context: "These learner and opposing excerpts are cited together in your rebuttal coaching. Identify the strongest reason in the quoted objection, answer it fairly, and explain how any valid concession affects your position." };
    }
    return { family, status: "no_cited_opposing_excerpt", references: [], context: "" };
  }
  if (family === "warrant") {
    // Separate exact excerpts avoid inventing a claim/evidence pairing.
    const evidence = (feedback.rubric.evidenceUsage.evidence ?? []).find(e =>
      typeof e?.excerpt === "string" && e.excerpt.trim() && e.excerpt.length <= 2000 && e.excerpt !== source.excerpt &&
      turns.some(t => t.id === e.turnId && t.role === "user" && t.content.includes(e.excerpt)));
    if (!evidence) return { family, status: "no_distinct_evidence_excerpt", references: [], context: "" };
    return { family, status: "eligible", references: [source, { turnId: evidence.turnId, excerpt: evidence.excerpt, role: "user" }],
      context: "First is the argument excerpt; second is an evidence excerpt from your debate. Explain whether and how they connect. If the evidence is irrelevant, explain why it cannot support the claim. These are unverified transcript statements." };
  }
  return { family, status: "eligible", references: [source], context: REPAIR_PRACTICE_CARD };
}

/**
 * Explains, per drill family, whether a debate can be routed to it and why
 * not. Content-free: returns statuses only, so it is safe for audits.
 */
export function diagnoseRouting(feedback: DebateFeedbackV2, turns: DebateTurn[], approved: string[]): { routable: boolean; families: { family: DrillFamily; status: RoutingStatus }[] } {
  if (!routableFeedback(feedback)) return { routable: false, families: [] };
  return { routable: true, families: FAMILY_ORDER.map(family => ({ family,
    status: approved.includes(DRILL_TEMPLATES[family].version) ? routeFamily(family, feedback, turns).status : "not_approved" as const })) };
}

export function recommendDrill(feedback: DebateFeedbackV2, turns: DebateTurn[], difficulty: Difficulty, approved: string[], model: string): { citedTurnId: string; exercise: DrillExercise; reassessment: DrillExercise } | null {
  if (!routableFeedback(feedback)) return null;
  const families = FAMILY_ORDER.filter(f => approved.includes(DRILL_TEMPLATES[f].version))
    .sort((a, b) => feedback.rubric[DRILL_TEMPLATES[a].competency].score - feedback.rubric[DRILL_TEMPLATES[b].competency].score);
  for (const family of families) {
    const template = DRILL_TEMPLATES[family];
    const { status, references, context } = routeFamily(family, feedback, turns);
    if (status !== "eligible") continue;
    const source = references[0];
    const exercise: DrillExercise = {
      family, templateVersion: template.version, title: template.title, competency: template.competency,
      difficulty, instructions: `${template.instructions} ${DIFFICULTY_INSTRUCTIONS[family][difficulty]}`,
      context, references, checks: template.checks, rubricVersion: RUBRIC_VERSION,
      promptVersion: LEARNING_PROMPT_VERSION, model, kind: "drill",
    };
    return { citedTurnId: source.turnId, exercise, reassessment: {
      ...exercise, kind: "reassessment", title: `Reassessment: ${template.title}`,
      instructions: `Apply the same skill without coaching hints. ${DIFFICULTY_INSTRUCTIONS[family][difficulty]}`,
      context: template.retest, references: [],
    } };
  }
  return null;
}
