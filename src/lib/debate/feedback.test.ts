import { describe, expect, it } from "vitest";
import { adaptFeedback, normalizeFeedbackResult } from "./feedback";
import { DebateFeedbackV1, DebateTurn } from "./types";

const turns: DebateTurn[] = [
  {
    id: "turn-user-1",
    debate_id: "d1",
    stage: "opening_user",
    role: "user",
    content: "Carbon pricing works because it prices the externality directly.",
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "turn-ai-1",
    debate_id: "d1",
    stage: "opening_ai",
    role: "ai",
    content: "A tax can hurt low income households without rebates.",
    created_at: "2026-01-01T00:01:00Z",
  },
];

describe("normalizeFeedbackResult", () => {
  it("normalizes v2 feedback and keeps only validated evidence", () => {
    const result = normalizeFeedbackResult(
      JSON.stringify({
        version: 2,
        overallScore: 8,
        summary: "Strong structure with room for more evidence.",
        strongestMoment: {
          title: "Clear mechanism",
          detail: "The opening explained the mechanism cleanly.",
          evidence: [
            {
              turnId: "turn-user-1",
              excerpt: "prices the externality directly",
            },
            {
              turnId: "turn-user-1",
              excerpt: "not actually in the transcript",
            },
            {
              turnId: "missing",
              excerpt: "Carbon pricing works",
            },
          ],
        },
        priorityImprovement: {
          title: "Add distributional evidence",
          detail: "Answer the rebate concern with specifics.",
          evidence: [],
        },
        rubric: {
          argumentStrength: {
            score: 8,
            rationale: "The warrant was clear.",
            evidence: [
              {
                turnId: "turn-user-1",
                excerpt: "Carbon pricing works",
              },
            ],
          },
          evidenceUsage: { score: 5, rationale: "Needs data.", evidence: [] },
          rebuttalQuality: { score: 6, rationale: "Some rebuttal.", evidence: [] },
          rhetoricalSkill: { score: 7, rationale: "Clear prose.", evidence: [] },
        },
        practiceRecommendation: {
          focus: "Use quantitative evidence",
          motion: "This house would tax carbon",
          difficulty: "advanced",
          rationale: "This targets the evidence gap.",
        },
        strengths: ["Clear mechanism"],
        improvements: ["Use more evidence"],
      }),
      turns
    );

    expect(result?.version).toBe(2);
    expect(result?.strongestMoment.evidence).toHaveLength(1);
    expect(result?.strongestMoment.evidence[0].turnId).toBe("turn-user-1");
    expect(result?.practiceRecommendation.difficulty).toBe("advanced");
  });

  it("adapts legacy feedback into the v2 shape", () => {
    const legacy: DebateFeedbackV1 = {
      overallScore: 6,
      argumentStrength: 7,
      evidenceUsage: 4,
      rebuttalQuality: 5,
      rhetoricalSkill: 6,
      summary: "Good start.",
      strengths: ["Clear opening"],
      improvements: ["Use more examples"],
    };

    const adapted = adaptFeedback(legacy);

    expect(adapted.version).toBe(2);
    expect(adapted.rubric.argumentStrength.score).toBe(7);
    expect(adapted.priorityImprovement.title).toBe("Use more examples");
  });

  it("recovers and parses partially truncated JSON responses", () => {
    const truncated = `{
      "version": 2,
      "overallScore": 7,
      "summary": "Solid argument development with clear structure.",
      "strongestMoment": {
        "title": "Clear mechanism",
        "detail": "Good opening statement.",
        "evidence": []
      },
      "priorityImprovement": {
        "title": "Deepen warrants",
        "detail": "Add more empirical support.",
        "evidence": []
      },
      "rubric": {
        "argumentStrength": { "score": 7, "rationale": "Strong warrants.", "evidence": [] },
        "evidenceUsage": { "score": 6, "rationale": "Needs data.", "evidence": [] },
        "rebuttalQuality": { "score": 7, "rationale": "Solid rebuttals.", "evidence": [] },
        "rhetoricalSkill": { "score": 7, "rationale": "Well formatted.", "evidence": [
          { "turnId": "turn-user-1", "excerpt": "Carbon pricing works`;

    const result = normalizeFeedbackResult(truncated, turns);
    expect(result).not.toBeNull();
    expect(result?.version).toBe(2);
    expect(result?.overallScore).toBe(7);
    expect(result?.summary).toBe("Solid argument development with clear structure.");
    expect(result?.rubric.rhetoricalSkill.score).toBe(7);
  });
});
