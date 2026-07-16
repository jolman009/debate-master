import { describe, it, expect } from "vitest";
import { extractJson, normalizeJudgeResult } from "./judge";

const fullVerdict = {
  pro: {
    score: 8,
    argumentStrength: 8,
    evidenceUsage: 7,
    rebuttalQuality: 9,
    rhetoricalSkill: 8,
    summary: "Strong, well-evidenced case.",
    strengths: ["Clear structure", "Good data"],
    improvements: ["Could press harder"],
  },
  con: {
    score: 6,
    argumentStrength: 6,
    evidenceUsage: 5,
    rebuttalQuality: 6,
    rhetoricalSkill: 7,
    summary: "Rhetorically able but thin on evidence.",
    strengths: ["Confident delivery"],
    improvements: ["Bring evidence"],
  },
  winner: "pro",
  rationale: "PRO carried the evidential burden.",
};

describe("extractJson", () => {
  it("parses a bare JSON object", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses JSON inside ``` fences", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("parses JSON surrounded by prose", () => {
    expect(extractJson('Here is my verdict: {"a":1} — done.')).toEqual({ a: 1 });
  });

  it("returns null when there is no JSON", () => {
    expect(extractJson("I could not decide.")).toBeNull();
    expect(extractJson("{ not valid json")).toBeNull();
  });
});

describe("normalizeJudgeResult", () => {
  it("passes a well-formed verdict through intact", () => {
    const r = normalizeJudgeResult(JSON.stringify(fullVerdict))!;
    expect(r.winner).toBe("pro");
    expect(r.pro.score).toBe(8);
    expect(r.con.score).toBe(6);
    expect(r.rationale).toBe("PRO carried the evidential burden.");
    expect(r.pro.strengths).toEqual(["Clear structure", "Good data"]);
  });

  it("refuses (null) when the response is not a usable verdict", () => {
    // A bogus verdict would permanently move Elo — better to fail loudly.
    expect(normalizeJudgeResult("the debate was close")).toBeNull();
    expect(normalizeJudgeResult('{"winner":"pro"}')).toBeNull();
    expect(normalizeJudgeResult("[1,2,3]")).toBeNull();
  });

  it("clamps out-of-range and non-numeric scores to 1-10", () => {
    const r = normalizeJudgeResult(
      JSON.stringify({
        ...fullVerdict,
        pro: { ...fullVerdict.pro, score: 99, argumentStrength: -4 },
        con: { ...fullVerdict.con, score: "7", evidenceUsage: null },
      })
    )!;
    expect(r.pro.score).toBe(10);
    expect(r.pro.argumentStrength).toBe(1);
    expect(r.con.score).toBe(7);
    expect(r.con.evidenceUsage).toBe(5);
  });

  it("derives the winner from scores when the ruling is missing or garbled", () => {
    const missing = normalizeJudgeResult(
      JSON.stringify({ ...fullVerdict, winner: undefined })
    )!;
    expect(missing.winner).toBe("pro"); // 8 > 6

    const garbled = normalizeJudgeResult(
      JSON.stringify({ ...fullVerdict, winner: "the pro side, clearly" })
    )!;
    expect(garbled.winner).toBe("pro");

    const tied = normalizeJudgeResult(
      JSON.stringify({
        ...fullVerdict,
        winner: null,
        con: { ...fullVerdict.con, score: 8 },
      })
    )!;
    expect(tied.winner).toBe("draw");
  });

  it("honours a valid explicit ruling and accepts draws", () => {
    const r = normalizeJudgeResult(
      JSON.stringify({ ...fullVerdict, winner: "DRAW" })
    )!;
    expect(r.winner).toBe("draw");
  });

  it("fills missing prose and arrays rather than failing", () => {
    const r = normalizeJudgeResult(
      JSON.stringify({
        pro: { score: 7 },
        con: { score: 5 },
        winner: "pro",
      })
    )!;
    expect(r.pro.summary).toContain("PRO");
    expect(r.pro.strengths.length).toBeGreaterThan(0);
    expect(r.con.improvements.length).toBeGreaterThan(0);
    expect(r.rationale).toBe("The judge did not provide a rationale.");
  });

  it("handles a fenced verdict from the model", () => {
    const r = normalizeJudgeResult(
      "```json\n" + JSON.stringify(fullVerdict) + "\n```"
    )!;
    expect(r.winner).toBe("pro");
  });
});
