import {
  DebateFeedback,
  DebateFeedbackV1,
  DebateFeedbackV2,
  DebateTurn,
  Difficulty,
  FeedbackCoachingClaim,
  FeedbackEvidenceReference,
  FeedbackRubricItem,
} from "./types";
import { extractJson } from "./judge";

const RUBRIC_KEYS = [
  "argumentStrength",
  "evidenceUsage",
  "rebuttalQuality",
  "rhetoricalSkill",
] as const;

type RubricKey = (typeof RUBRIC_KEYS)[number];

function clampScore(value: unknown, fallback = 5): number {
  if (value === null || value === undefined || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(10, Math.max(1, Math.round(n)));
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const items = value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0
  );
  return items.length > 0 ? items.slice(0, 4) : fallback;
}

function normalizeDifficulty(value: unknown): Difficulty {
  return value === "beginner" || value === "advanced"
    ? value
    : "intermediate";
}

function normalizeEvidence(
  value: unknown,
  turns: DebateTurn[]
): FeedbackEvidenceReference[] {
  if (!Array.isArray(value)) return [];
  const turnMap = new Map(turns.map((turn) => [turn.id, turn]));
  const evidence: FeedbackEvidenceReference[] = [];

  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const item = raw as Record<string, unknown>;
    const turnId = stringOr(item.turnId, "");
    const excerpt = stringOr(item.excerpt, "");
    const turn = turnMap.get(turnId);
    if (!turn || !excerpt || !turn.content.includes(excerpt)) continue;

    evidence.push({
      turnId,
      stage: turn.stage,
      speakerRole: turn.role,
      excerpt,
    });
  }

  return evidence.slice(0, 3);
}

function normalizeClaim(
  value: unknown,
  turns: DebateTurn[],
  fallback: FeedbackCoachingClaim
): FeedbackCoachingClaim {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }
  const raw = value as Record<string, unknown>;
  return {
    title: stringOr(raw.title, fallback.title),
    detail: stringOr(raw.detail, fallback.detail),
    evidence: normalizeEvidence(raw.evidence, turns),
  };
}

function normalizeRubricItem(
  value: unknown,
  turns: DebateTurn[],
  fallbackScore: number,
  fallbackRationale: string
): FeedbackRubricItem {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    score: clampScore(raw.score, fallbackScore),
    rationale: stringOr(raw.rationale, fallbackRationale),
    evidence: normalizeEvidence(raw.evidence, turns),
  };
}

export function adaptFeedback(feedback: DebateFeedback): DebateFeedbackV2 {
  if ("version" in feedback && feedback.version === 2) return feedback;

  const legacy = feedback as DebateFeedbackV1;
  return {
    version: 2,
    overallScore: clampScore(legacy.overallScore),
    summary: legacy.summary,
    strongestMoment: {
      title: legacy.strengths[0] ?? "Completed the debate",
      detail: legacy.strengths[0] ?? legacy.summary,
      evidence: [],
    },
    priorityImprovement: {
      title: legacy.improvements[0] ?? "Sharpen the next argument",
      detail: legacy.improvements[0] ?? "No specific improvement was returned.",
      evidence: [],
    },
    rubric: {
      argumentStrength: {
        score: clampScore(legacy.argumentStrength),
        rationale: "Legacy feedback did not include a separate rationale.",
        evidence: [],
      },
      evidenceUsage: {
        score: clampScore(legacy.evidenceUsage),
        rationale: "Legacy feedback did not include a separate rationale.",
        evidence: [],
      },
      rebuttalQuality: {
        score: clampScore(legacy.rebuttalQuality),
        rationale: "Legacy feedback did not include a separate rationale.",
        evidence: [],
      },
      rhetoricalSkill: {
        score: clampScore(legacy.rhetoricalSkill),
        rationale: "Legacy feedback did not include a separate rationale.",
        evidence: [],
      },
    },
    practiceRecommendation: {
      focus: legacy.improvements[0] ?? "Build a clearer warrant",
      motion: "Choose a motion that lets you practice this weakness.",
      difficulty: "intermediate",
      rationale: "Legacy feedback did not include targeted practice metadata.",
    },
    strengths: legacy.strengths,
    improvements: legacy.improvements,
  };
}

export function normalizeFeedbackResult(
  text: string,
  turns: DebateTurn[]
): DebateFeedbackV2 | null {
  const raw = extractJson(text);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const data = raw as Record<string, unknown>;
  if (data.version !== 2) {
    return adaptFeedback({
      overallScore: clampScore(data.overallScore),
      argumentStrength: clampScore(data.argumentStrength),
      evidenceUsage: clampScore(data.evidenceUsage),
      rebuttalQuality: clampScore(data.rebuttalQuality),
      rhetoricalSkill: clampScore(data.rhetoricalSkill),
      summary: stringOr(data.summary, text),
      strengths: stringArray(data.strengths, ["Completed the debate"]),
      improvements: stringArray(data.improvements, [
        "Could not parse structured coaching",
      ]),
    });
  }

  const rubricRaw =
    data.rubric && typeof data.rubric === "object" && !Array.isArray(data.rubric)
      ? (data.rubric as Record<string, unknown>)
      : {};
  const legacyScores = data as Record<RubricKey, unknown>;
  const rubric = RUBRIC_KEYS.reduce((acc, key) => {
    acc[key] = normalizeRubricItem(
      rubricRaw[key],
      turns,
      clampScore(legacyScores[key]),
      "The coach did not provide a rationale for this rubric item."
    );
    return acc;
  }, {} as DebateFeedbackV2["rubric"]);

  const strengths = stringArray(data.strengths, [
    stringOr(
      (data.strongestMoment as Record<string, unknown> | undefined)?.title,
      "Completed the debate"
    ),
  ]);
  const improvements = stringArray(data.improvements, [
    stringOr(
      (data.priorityImprovement as Record<string, unknown> | undefined)?.title,
      "Sharpen the next argument"
    ),
  ]);
  const practice =
    data.practiceRecommendation &&
    typeof data.practiceRecommendation === "object" &&
    !Array.isArray(data.practiceRecommendation)
      ? (data.practiceRecommendation as Record<string, unknown>)
      : {};

  return {
    version: 2,
    overallScore: clampScore(data.overallScore),
    summary: stringOr(data.summary, "The coach returned no summary."),
    strongestMoment: normalizeClaim(data.strongestMoment, turns, {
      title: strengths[0],
      detail: strengths[0],
      evidence: [],
    }),
    priorityImprovement: normalizeClaim(data.priorityImprovement, turns, {
      title: improvements[0],
      detail: improvements[0],
      evidence: [],
    }),
    rubric,
    practiceRecommendation: {
      focus: stringOr(practice.focus, improvements[0]),
      motion: stringOr(practice.motion, "Repeat the debate with a clearer claim."),
      difficulty: normalizeDifficulty(practice.difficulty),
      rationale: stringOr(
        practice.rationale,
        "This practice target follows from the priority improvement."
      ),
    },
    strengths,
    improvements,
  };
}
