import { afterEach, describe, expect, it, vi } from "vitest";
import { parseTargetedAssessment } from "./assessment";
import { learningEnabled, approvedTemplateVersions } from "./flags";
import { recommendDrill } from "./recommendation";
import { DRILL_TEMPLATES } from "./drill-templates";
import type { DebateFeedbackV2, DebateTurn } from "@/lib/debate/types";

afterEach(() => vi.unstubAllEnvs());
describe("targeted scoring", () => {
  const value = { status: "valid", score: 7, rationale: "Clear warrant", strength: "Links the claim", correction: "Name a limit", retryInstruction: "Add the assumption", excerpts: ["My claim"] };
  it("accepts a grounded single dimension score", () => expect(parseTargetedAssessment(JSON.stringify(value), "My claim is supported." )?.score).toBe(7));
  it.each([null, "7", 0, 11, 7.5, true])("rejects invalid score %s without coercion", score => expect(parseTargetedAssessment(JSON.stringify({ ...value, score }), "My claim")).toBeNull());
  it("rejects fabricated or missing references", () => {
    expect(parseTargetedAssessment(JSON.stringify(value), "Different answer")).toBeNull();
    expect(parseTargetedAssessment(JSON.stringify({ ...value, excerpts: [] }), "My claim")).toBeNull();
  });
  it("permits explicit insufficient evidence without a score", () => {
    expect(parseTargetedAssessment(JSON.stringify({ ...value, status: "insufficient", score: null, excerpts: [] }), "Unsure")?.status).toBe("insufficient");
    expect(parseTargetedAssessment(JSON.stringify({ ...value, status: "insufficient" }), "My claim")).toBeNull();
  });
});
describe("learning release controls", () => {
  it("defaults off with no approved curriculum", () => {
    vi.stubEnv("LEARNING_ROLLOUT", ""); vi.stubEnv("LEARNING_APPROVED_TEMPLATES", "");
    expect(learningEnabled("u")).toBe(false); expect(approvedTemplateVersions()).toEqual([]);
  });
  it("requires exact pilot inclusion and rejects unknown flags", () => {
    vi.stubEnv("LEARNING_ROLLOUT", "pilot"); vi.stubEnv("LEARNING_PILOT_USERS", "one, two ");
    expect(learningEnabled("two")).toBe(true); expect(learningEnabled("tw")).toBe(false);
    vi.stubEnv("LEARNING_ROLLOUT", "yes"); expect(learningEnabled("two")).toBe(false);
  });
});
describe("evidence-based drill routing", () => {
  const turns = [
    { id: "opponent", role: "ai", content: "But students need a quiet place." },
    { id: "learner", role: "user", content: "My claim. My evidence." },
  ] as DebateTurn[];
  function feedback(): DebateFeedbackV2 {
    return { version: 2, overallScore: 5, assessment: { status: "valid" }, rubric: Object.fromEntries(
      ["argumentStrength", "evidenceUsage", "rebuttalQuality", "rhetoricalSkill"].map(k => [k, {
        score: k === "rebuttalQuality" ? 3 : 5,
        evidence: [{ turnId: "learner", excerpt: k === "evidenceUsage" ? "My evidence." : "My claim." }],
      }])) } as DebateFeedbackV2;
  }
  const all = Object.values(DRILL_TEMPLATES).map(t => t.version);
  it("selects the weakest supported competency with actual opposing context", () => {
    const r = recommendDrill(feedback(), turns, "beginner", all, "test-model");
    expect(r?.exercise.family).toBe("counterargument");
    expect(r?.exercise.references[1].turnId).toBe("opponent");
    expect(r?.reassessment.references).toEqual([]);
    expect(r?.reassessment.model).toBe("test-model");
  });
  it("requires approved templates and valid provenance", () => {
    expect(recommendDrill(feedback(), turns, "beginner", [], "m")).toBeNull();
    const f = feedback(); delete f.assessment;
    expect(recommendDrill(f, turns, "beginner", all, "m")).toBeNull();
  });
  it("does not invent a warrant evidence pair", () => {
    const f = feedback(); f.rubric.evidenceUsage.evidence = [];
    expect(recommendDrill(f, turns, "beginner", [DRILL_TEMPLATES.warrant.version], "m")).toBeNull();
    expect(recommendDrill(feedback(), turns, "advanced", [DRILL_TEMPLATES.warrant.version], "m")?.exercise.references).toHaveLength(2);
  });
  it("rejects fabricated learner excerpts and missing opposing turns", () => {
    const f = feedback(); f.rubric.rebuttalQuality.evidence[0].excerpt = "Fabricated";
    expect(recommendDrill(f, turns, "beginner", [all[0]], "m")).toBeNull();
    expect(recommendDrill(feedback(), turns.slice(1), "beginner", [all[0]], "m")).toBeNull();
  });
  it("makes absent verification explicit for claim repair", () => {
    expect(recommendDrill(feedback(), turns, "beginner", [DRILL_TEMPLATES.repair.version], "m")?.exercise.context).toContain("No independently verified source");
  });
});
