import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ rpc: vi.fn(), stream: vi.fn(), report: vi.fn(), stage: "opening_ai", user: "owner" as string | null }));
vi.mock("@/lib/supabase/admin", () => ({ createServiceClient: () => ({ rpc: m.rpc }) }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: () => ({
  auth: { getUser: async () => ({ data: { user: m.user ? { id: m.user } : null } }) },
  from: (table: string) => {
    const q = { select: () => q, eq: () => q,
      single: async () => ({ data: { id: "debate", current_stage: m.stage, config: { mode: "ai", personaId: "logician", userSide: "pro", rebuttalCycles: 1 } } }),
      order: async () => ({ data: table === "debate_turns" ? [] : null }) };
    return q;
  },
}) }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ success: true }), clientIp: () => "ip" }));
vi.mock("@/lib/observability", () => ({ reportError: m.report }));
vi.mock("@/lib/debate/content", () => ({ getPersonaBySlug: async () => ({ systemPrompt: "persona" }) }));
vi.mock("@/lib/gemini", () => ({ getGeminiClient: () => ({ models: { generateContentStream: m.stream } }), GEMINI_FALLBACK_MODELS: ["test"], isRetryableGeminiError: () => false }));
import { POST } from "./route";
const request = (body = {}, signal?: AbortSignal) => POST(new Request("http://localhost/api/debate/debate/turn", { method: "POST", body: JSON.stringify(body), signal }), { params: { debateId: "debate" } });
beforeEach(() => {
  vi.clearAllMocks(); m.stage = "opening_ai"; m.user = "owner";
  m.rpc.mockImplementation(async (name: string) => ({ data: name === "claim_ai_debate_turn" ? "lease" : true, error: null }));
  m.stream.mockImplementation(async function* () { yield { text: "Complete answer", candidates: [{ finishReason: "STOP" }] }; });
});
describe("atomic AI turn orchestration", () => {
  it("requires authentication before using the writer", async () => {
    m.user = null; expect((await request()).status).toBe(401); expect(m.rpc).not.toHaveBeenCalled();
  });
  it("does not invoke the provider when another client holds the lease", async () => {
    m.rpc.mockResolvedValue({ data: null, error: null });
    expect((await request()).status).toBe(409); expect(m.stream).not.toHaveBeenCalled();
  });
  it("commits complete text using its fencing token before sending done", async () => {
    expect(await (await request()).text()).toContain('"done":true');
    expect(m.rpc).toHaveBeenCalledWith("commit_ai_debate_turn", expect.objectContaining({ p_token: "lease", p_content: "Complete answer", p_next_stage: "rebuttal_user_1" }));
    expect(m.rpc).toHaveBeenLastCalledWith("release_ai_debate_turn", expect.objectContaining({ p_token: "lease" }));
  });
  it("rejects truncated output without persisting it and releases for retry", async () => {
    m.stream.mockImplementation(async function* () { yield { text: "Partial", candidates: [{ finishReason: "MAX_TOKENS" }] }; });
    const response = await (await request()).text();
    expect(response).toContain('"error"'); expect(response).not.toContain('"done":true');
    expect(m.rpc.mock.calls.some(([name]) => name === "commit_ai_debate_turn")).toBe(false);
    expect(m.rpc).toHaveBeenLastCalledWith("release_ai_debate_turn", expect.anything());
  });
  it("cannot report success when its lease has been replaced", async () => {
    m.rpc.mockImplementation(async (name: string) => ({ data: name === "claim_ai_debate_turn" ? "old-lease" : false, error: null }));
    const response = await (await request()).text();
    expect(response).toContain('"error"'); expect(response).not.toContain('"done":true');
  });
  it("does not generate AI after a conflicting atomic user submission", async () => {
    m.stage = "opening_user"; m.rpc.mockResolvedValue({ data: false, error: null });
    expect((await request({ content: "My argument" })).status).toBe(409);
    expect(m.stream).not.toHaveBeenCalled(); expect(m.rpc).toHaveBeenCalledTimes(1);
  });
  it("does not persist on client abort", async () => {
    const controller = new AbortController(); controller.abort();
    await (await request({}, controller.signal)).text();
    expect(m.rpc.mock.calls.some(([name]) => name === "commit_ai_debate_turn")).toBe(false);
  });
  it("releases a failed provider attempt without exposing its message", async () => {
    m.stream.mockRejectedValue(new Error("PRIVATE PROVIDER PAYLOAD"));
    expect(await (await request()).text()).not.toContain("PRIVATE PROVIDER PAYLOAD");
    expect(JSON.stringify(m.report.mock.calls)).not.toContain("PRIVATE PROVIDER PAYLOAD");
    expect(m.rpc).toHaveBeenLastCalledWith("release_ai_debate_turn", expect.anything());
  });
});
