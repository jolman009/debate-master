import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
const { generate, report } = vi.hoisted(() => ({ generate: vi.fn(), report: vi.fn() }));
vi.mock("@/lib/gemini", () => ({ GEMINI_MODEL: "test-model", getGeminiClient: () => ({ models: { generateContent: generate } }) }));
vi.mock("@/lib/observability", () => ({ reportError: report }));
import { submitResponse } from "./service";
const exercise = { templateVersion: "counterargument-response-v1", model: "test-model", competency: "rebuttalQuality", kind: "drill", promptVersion: "targeted-coach-1", rubricVersion: "debate-anchors-1", difficulty: "beginner" };
const input = { requestId: "request", content: "My answer", kind: "initial" as const, revision: 0 };
const valid = { status: "valid", score: 7, rationale: "Answers the objection", strength: "Clear reply", correction: "Weigh the cases", retryInstruction: "Explain the tradeoff", excerpts: ["My answer"] };
function database(claimed = true) {
  const rpc = vi.fn().mockResolvedValueOnce({ data: { claimed, response: { id: "response", content: "My answer", lease_token: "token", status: claimed ? "pending" : "evaluated" } }, error: null }).mockResolvedValue({ data: true, error: null });
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { exercise }, error: null }) };
  return { client: { from: () => query, rpc } as unknown as SupabaseClient, rpc };
}
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("LEARNING_APPROVED_TEMPLATES", exercise.templateVersion); });
describe("evaluation orchestration", () => {
  it("does not call the model for an already accepted submission", async () => {
    const { client, rpc } = database(false);
    expect(await submitResponse(client, "owner", "session", input)).toEqual({ pending: false });
    expect(generate).not.toHaveBeenCalled(); expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("persists grounded targeted feedback with provenance and total token usage", async () => {
    generate.mockResolvedValue({ text: JSON.stringify(valid), usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, thoughtsTokenCount: 3, totalTokenCount: 33 } });
    const { client, rpc } = database();
    await submitResponse(client, "owner", "session", input);
    expect(rpc).toHaveBeenLastCalledWith("learning_finish", expect.objectContaining({
      p_user_id: "owner", p_token: "token", p_outcome: "valid",
      p_assessment: expect.objectContaining({ score: 7, provenance: expect.objectContaining({ model: "test-model" }) }),
      p_usage: expect.objectContaining({ totalTokens: 33, thinkingTokens: 3 }),
    }));
  });
  it("records invalid scores as technical failure, not completed feedback", async () => {
    generate.mockResolvedValue({ text: JSON.stringify({ ...valid, score: 5.5 }) });
    const { client, rpc } = database();
    await expect(submitResponse(client, "owner", "session", input)).rejects.toMatchObject({ status: 502 });
    expect(rpc).toHaveBeenLastCalledWith("learning_finish", expect.objectContaining({ p_outcome: "invalid", p_assessment: null }));
  });
  it("records provider failure without logging learner/provider content", async () => {
    generate.mockRejectedValue(new Error("Sensitive provider body"));
    const { client, rpc } = database();
    await expect(submitResponse(client, "owner", "session", input)).rejects.toMatchObject({ status: 502 });
    expect(rpc).toHaveBeenLastCalledWith("learning_finish", expect.objectContaining({ p_outcome: "failed" }));
    expect(report.mock.calls[0][0].message).toBe("Learning evaluation failed");
  });
  it("does not report a stale worker result as saved", async () => {
    generate.mockResolvedValue({ text: JSON.stringify(valid) });
    const { client, rpc } = database();
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await submitResponse(client, "owner", "session", input)).toEqual({ pending: true });
  });
});
