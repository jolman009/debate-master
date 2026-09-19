import { describe, expect, it } from "vitest";
import { normalizeFeedbackResult, isValidAssessment } from "./feedback";
const valid = { version: 2, overallScore: 7, rubric: Object.fromEntries(["argumentStrength", "evidenceUsage", "rebuttalQuality", "rhetoricalSkill"].map(k => [k, { score: 7 }])) };
describe("measurement validity", () => {
  it.each([null, undefined, "7", true, 0, 11, 5.5])("rejects unmeasured score %s", score => {
    expect(normalizeFeedbackResult(JSON.stringify({ ...valid, overallScore: score }), [])).toBeNull();
    expect(normalizeFeedbackResult(JSON.stringify({ ...valid, rubric: { ...valid.rubric, evidenceUsage: { score } } }), [])).toBeNull();
  });
  it("excludes unprovenanced and legacy evaluations", () => {
    expect(isValidAssessment(normalizeFeedbackResult(JSON.stringify(valid), [])!)).toBe(false);
    expect(normalizeFeedbackResult('{"overallScore":7}', [])).toBeNull();
  });
});
