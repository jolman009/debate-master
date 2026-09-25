import { isValidAssessment } from "@/lib/debate/feedback";
import type { DebateFeedbackV2, DebateTurn, Difficulty } from "@/lib/debate/types";
import { RUBRIC_VERSION } from "@/lib/debate/rubric";
import { DIFFICULTY_INSTRUCTIONS, DRILL_TEMPLATES, FAMILY_ORDER, LEARNING_PROMPT_VERSION, type DrillExercise, type ExerciseReference } from "./drill-templates";

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
      return turn && e.excerpt.trim() && e.excerpt.length <= 2000 && turn.content.includes(e.excerpt)
        ? [{ turnId: turn.id, excerpt: e.excerpt, role: "user" as const }] : [];
    });
    if (!references.length) continue;
    const source = references[0];
    let context: string;
    if (family === "counterargument") {
      const index = turns.findIndex(t => t.id === source.turnId);
      const opponent = turns.slice(0, index).reverse().find(t => t.role === "ai" && t.content.trim() && t.content.length <= 6000);
      if (!opponent) continue;
      references.splice(1, references.length, { turnId: opponent.id, excerpt: opponent.content, role: "ai" });
      context = "Your original response and the preceding opposing argument are quoted below. Identify and answer the strongest reason in that argument.";
    } else if (family === "warrant") {
      // Separate exact excerpts avoid inventing a claim/evidence pairing.
      const evidence = (feedback.rubric.evidenceUsage.evidence ?? []).find(e =>
        e.excerpt.trim() && e.excerpt.length <= 2000 && e.excerpt !== source.excerpt &&
        turns.some(t => t.id === e.turnId && t.role === "user" && t.content.includes(e.excerpt)));
      if (!evidence) continue;
      references.splice(1, references.length, { turnId: evidence.turnId, excerpt: evidence.excerpt, role: "user" });
      context = "First is the argument excerpt; second is an evidence excerpt from your debate. Explain whether and how they connect. If the evidence is irrelevant, explain why it cannot support the claim. These are unverified transcript statements.";
    } else {
      references.splice(1);
      context = "Support available for this exercise: only the quoted claim. No independently verified source is supplied. Narrow it to a conditional claim, distinguish assertion from evidence, and name the support still needed.";
    }
    const exercise: DrillExercise = {
      family, templateVersion: template.version, title: template.title, competency: template.competency,
      difficulty, instructions: `${template.instructions} ${DIFFICULTY_INSTRUCTIONS[difficulty]}`,
      context, references, checks: template.checks, rubricVersion: RUBRIC_VERSION,
      promptVersion: LEARNING_PROMPT_VERSION, model, kind: "drill",
    };
    return { citedTurnId: source.turnId, exercise, reassessment: {
      ...exercise, kind: "reassessment", title: `Reassessment: ${template.title}`,
      instructions: `Apply the same skill without coaching hints. ${DIFFICULTY_INSTRUCTIONS[difficulty]}`,
      context: template.retest, references: [],
    } };
  }
  return null;
}
