import { beforeEach, describe, expect, it, vi } from "vitest";
const { rpc, getUser } = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: () => ({ auth: { getUser }, rpc }) }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ success: true }) }));
import { POST } from "./route";
const request = (body: unknown) => new Request("http://localhost/api/measurement", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("MEASUREMENT_ROLLOUT", "on"); getUser.mockResolvedValue({ data: { user: { id: "owner" } } }); rpc.mockResolvedValue({ error: null }); });
describe("owned coaching views", () => {
  it("requires authentication", async () => { getUser.mockResolvedValue({ data: { user: null } }); expect((await POST(request({}))).status).toBe(401); expect(rpc).not.toHaveBeenCalled(); });
  it("rejects text and caller ownership", async () => { expect((await POST(request({ sessionId: "123", motion: "private", userId: "other" }))).status).toBe(400); expect(rpc).not.toHaveBeenCalled(); });
  it("uses only the session ID in the ownership-checking RPC", async () => { const sessionId = "11111111-1111-1111-1111-111111111111"; expect((await POST(request({ sessionId }))).status).toBe(204); expect(rpc).toHaveBeenCalledWith("record_coaching_view", { p_session_id: sessionId }); });
  it("conceals inaccessible sessions", async () => { rpc.mockResolvedValue({ error: { message: "Session not available" } }); expect((await POST(request({ sessionId: "11111111-1111-1111-1111-111111111111" }))).status).toBe(404); });
  it("honors server rollback", async () => { vi.stubEnv("MEASUREMENT_ROLLOUT", "off"); expect((await POST(request({}))).status).toBe(503); expect(rpc).not.toHaveBeenCalled(); });
});
