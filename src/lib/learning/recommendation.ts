import { isValidAssessment } from "@/lib/debate/feedback";
import type { DebateFeedbackV2, DebateTurn, Difficulty } from "@/lib/debate/types";
import { RUBRIC_VERSION } from "@/lib/debate/rubric";
import { REPAIR_PRACTICE_CARD, DIFFICULTY_INSTRUCTIONS, DRILL_TEMPLATES, FAMILY_ORDER, LEARNING_PROMPT_VERSION, type DrillExercise, type ExerciseReference } from "./drill-templates";

export function recommendDrill(feedback: DebateFeedbackV2, turns: DebateTurn[], difficulty: Difficulty, approved: string[], model: string): { citedTurnId: string; exercise: DrillExercise; reassessment: DrillExercise } | null {
  if (feedback.version !== 2 || !feedback.rubric ||
    !["argumentStrength", "evidenceUsage", "rebuttalQuality", "rhetoricalSkill"].every(k =>
      feedback.rubric[k as keyof typeof feedback.rubric] && Array.isArray(feedback.rubric[k as keyof typeof feedback.rubric].evidence)) ||
    !isValidAssessment(feedback)) return null;
  const families = FAMILY_ORDER.filter(f => approved.includes(DRILL_TEMPLATES[f].version))
    .sort((a, b) => feedback.rubric[DRILL_TEMPLATES[a].competency].score - feedback.rubric[DRILL_TEMPLATES[b].competency].score);
  for (const family of families) {
    const template = DRILL_TEMPLATES[family];
    const references: ExerciseReference[] = (feedback.rubric[template.competency].evidence ?? []).flatMap(e => {
      const turn = turns.find(t => t.id === e.turnId && t.role === "user");
      return turn && typeof e?.excerpt === "string" && e.excerpt.trim() && e.excerpt.length <= 2000 && turn.content.includes(e.excerpt)
        ? [{ turnId: turn.id, excerpt: e.excerpt, role: "user" as const }] : [];
    });
    if (!references.length) continue;
    const source = references[0];
    let context: string;
    if (family === "counterargument") {
      const index = turns.findIndex(t => t.id === source.turnId);
      // Require both sides to be cited by the same coaching dimension. Mere
      // chronological adjacency does not establish an argumentative connection.
      const opponentRef = feedback.rubric.rebuttalQuality.evidence.find(e =>
        typeof e?.excerpt === "string" && e.excerpt.trim() && e.excerpt.length <= 6000 &&
        turns.slice(0, index).some(t => t.id === e.turnId && t.role === "ai" && t.content.includes(e.excerpt)));
      if (!opponentRef) continue;
      references.splice(1, references.length, { turnId: opponentRef.turnId, excerpt: opponentRef.excerpt, role: "ai" });
      context = "These learner and opposing excerpts are cited together in your rebuttal coaching. Identify the strongest reason in the quoted objection, answer it fairly, and explain how any valid concession affects your position.";
    } else if (family === "warrant") {
      // Separate exact excerpts avoid inventing a claim/evidence pairing.
      const evidence = (feedback.rubric.evidenceUsage.evidence ?? []).find(e =>
        typeof e?.excerpt === "string" && e.excerpt.trim() && e.excerpt.length <= 2000 && e.excerpt !== source.excerpt &&
        turns.some(t => t.id === e.turnId && t.role === "user" && t.content.includes(e.excerpt)));
      if (!evidence) continue;
      references.splice(1, references.length, { turnId: evidence.turnId, excerpt: evidence.excerpt, role: "user" });
      context = "First is the argument excerpt; second is an evidence excerpt from your debate. Explain whether and how they connect. If the evidence is irrelevant, explain why it cannot support the claim. These are unverified transcript statements.";
    } else {
      references.splice(1);
      context = REPAIR_PRACTICE_CARD;
    }
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
