// Parsing/normalising the neutral judge's verdict.
//
// A verdict permanently moves both players' Elo, so this is deliberately
// strict-but-forgiving: we repair the things that don't change the outcome
// (out-of-range scores, missing prose, missing arrays) and REFUSE outright
// (return null) when the response isn't a usable verdict at all. The AI-mode
// feedback route can safely fall back to a placeholder; a ranked result cannot.

import { JudgeResult, JudgeSideScore, Side } from "./types";

function clampScore(value: unknown, fallback = 5): number {
  // A MISSING score falls back to neutral. Don't let Number(null)===0 slip
  // through and clamp to 1 — that would score an absent dimension as the
  // harshest possible mark. An explicitly out-of-range number still clamps.
  if (value === null || value === undefined || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(10, Math.max(1, Math.round(n)));
}

function toStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const out = value.filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0
  );
  return out.length > 0 ? out : fallback;
}

function normalizeSide(raw: unknown, side: Side): JudgeSideScore {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    score: clampScore(r.score),
    argumentStrength: clampScore(r.argumentStrength),
    evidenceUsage: clampScore(r.evidenceUsage),
    rebuttalQuality: clampScore(r.rebuttalQuality),
    rhetoricalSkill: clampScore(r.rhetoricalSkill),
    summary:
      typeof r.summary === "string" && r.summary.trim()
        ? r.summary
        : `The judge returned no summary for ${side.toUpperCase()}.`,
    strengths: toStringArray(r.strengths, ["Completed the debate"]),
    improvements: toStringArray(r.improvements, [
      "No specific improvements were returned",
    ]),
  };
}

/** Pull a JSON object out of a model response, tolerating ``` fences/prose. */
export function extractJson(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Normalise a raw judge response into a JudgeResult, or null if it cannot be
 * salvaged (caller should surface an error rather than record a bogus result).
 *
 * A valid explicit `winner` is always honoured — it's the judge's ruling and
 * the one the rationale explains. We only derive the winner from scores when
 * the ruling is missing or garbled.
 */
export function normalizeJudgeResult(text: string): JudgeResult | null {
  const raw = extractJson(text);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const r = raw as Record<string, unknown>;
  // Without at least one side's scorecard there is no verdict to record.
  if (!r.pro && !r.con) return null;

  const pro = normalizeSide(r.pro, "pro");
  const con = normalizeSide(r.con, "con");

  const stated =
    typeof r.winner === "string" ? r.winner.toLowerCase().trim() : "";
  const winner: Side | "draw" =
    stated === "pro" || stated === "con" || stated === "draw"
      ? (stated as Side | "draw")
      : pro.score > con.score
      ? "pro"
      : con.score > pro.score
      ? "con"
      : "draw";

  return {
    pro,
    con,
    winner,
    rationale:
      typeof r.rationale === "string" && r.rationale.trim()
        ? r.rationale
        : "The judge did not provide a rationale.",
  };
}
