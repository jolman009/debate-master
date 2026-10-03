import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ user: "owner" as string | null, debate: { id: "debate", feedback: {} } as object | null, write: vi.fn(), limit: true }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: () => ({
  auth: { getUser: async () => ({ data: { user: m.user ? { id: m.user } : null } }) },
  from: () => { const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: m.debate }) }; return q; },
}) }));
vi.mock("@/lib/supabase/admin", () => ({ createServiceClient: () => ({ from: () => ({ upsert: m.write }) }) }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ success: m.limit }) }));
vi.mock("@/lib/observability", () => ({ reportError: vi.fn() }));
import { POST } from "./route";
const send = (usefulness = "helpful") => POST(new NextRequest("http://localhost/api/feedback/usefulness", { method: "POST", body: JSON.stringify({ usefulness, sessionId: "11111111-1111-4111-8111-111111111111", transcript: "Must never be persisted" }) }));
beforeEach(() => { vi.clearAllMocks(); m.user = "owner"; m.debate = { id: "debate", feedback: {} }; m.limit = true; m.write.mockResolvedValue({ error: null }); });
describe("durable usefulness", () => {
  it("stores only a rating and owned identifiers, reopening review", async () => {
    expect((await send("reported")).status).toBe(200);
    expect(m.write).toHaveBeenCalledWith(expect.objectContaining({ user_id: "owner", debate_id: "debate", rating: "reported", reviewed_at: null }), { onConflict: "user_id,debate_id" });
    expect(JSON.stringify(m.write.mock.calls)).not.toContain("Must never be persisted");
  });
  it("requires authentication", async () => { m.user = null; expect((await send()).status).toBe(401); expect(m.write).not.toHaveBeenCalled(); });
  it("rejects inaccessible coaching", async () => { m.debate = null; expect((await send()).status).toBe(404); expect(m.write).not.toHaveBeenCalled(); });
  it("rejects invalid ratings", async () => { expect((await send("invalid")).status).toBe(400); expect(m.write).not.toHaveBeenCalled(); });
  it("reports persistence failure rather than success", async () => { m.write.mockResolvedValue({ error: {} }); expect((await send()).status).toBe(500); });
  it("rate limits writes", async () => { m.limit = false; expect((await send()).status).toBe(429); expect(m.write).not.toHaveBeenCalled(); });
});
