import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), admin: vi.fn(), rate: vi.fn(),
  open: vi.fn(), read: vi.fn(), recommend: vi.fn(), submit: vi.fn(), owned: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createServiceClient: mocks.admin }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mocks.rate }));
vi.mock("@/lib/observability", () => ({ reportError: vi.fn() }));
vi.mock("@/lib/learning/service", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/learning/service")>(),
  openCycle: mocks.open, readCycle: mocks.read, recommendation: mocks.recommend,
  submitResponse: mocks.submit, ownedRuntime: mocks.owned,
}));
import { GET, POST, PUT } from "./route";
import { LearningError } from "@/lib/learning/service";
const id = "10000000-0000-0000-0000-000000000001";
function request(path: string[], body?: unknown, method = "POST") {
  return new Request(`http://localhost/api/learning/${path.join("/")}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("LEARNING_ROLLOUT", "on");
  mocks.getUser.mockResolvedValue({ data: { user: { id: "verified-owner" } } });
  mocks.admin.mockReturnValue({ rpc: mocks.rpc }); mocks.rpc.mockResolvedValue({ data: 1, error: null });
  mocks.rate.mockResolvedValue({ success: true }); mocks.owned.mockResolvedValue({});
  mocks.open.mockResolvedValue(id); mocks.read.mockResolvedValue({ enabled: true }); mocks.submit.mockResolvedValue({ pending: false });
});
afterEach(() => vi.unstubAllEnvs());
describe("learning API boundaries", () => {
  it("rejects anonymous requests before creating a privileged client", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(request(["cycles"], {}), { params: { path: ["cycles"] } })).status).toBe(401);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("rejects caller-selected ownership and scopes creation to the verified user", async () => {
    const path = ["cycles"];
    expect((await POST(request(path, { debateId: id, requestId: id, userId: "other" }), { params: { path } })).status).toBe(400);
    expect(mocks.open).not.toHaveBeenCalled();
    expect((await POST(request(path, { debateId: id, requestId: id }), { params: { path } })).status).toBe(200);
    expect(mocks.open).toHaveBeenCalledWith(expect.anything(), "verified-owner", id, id);
  });
  it("blocks all writes while off but keeps owned reads available and private", async () => {
    vi.stubEnv("LEARNING_ROLLOUT", "off");
    const path = ["cycles", id];
    expect((await POST(request(["cycles"], {}), { params: { path: ["cycles"] } })).status).toBe(503);
    const result = await GET(request(path, undefined, "GET"), { params: { path } });
    expect(result.status).toBe(200); expect(result.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.read).toHaveBeenCalledWith(expect.anything(), "verified-owner", id);
  });
  it("does not infer anonymous ownership for another session", async () => {
    mocks.owned.mockRejectedValue(new LearningError("Practice session not found.", 404));
    const path = ["sessions", id, "draft"];
    expect((await PUT(request(path, { content: "answer", revision: 0 }, "PUT"), { params: { path } })).status).toBe(404);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("enforces rate limits before model or database work", async () => {
    mocks.rate.mockResolvedValue({ success: false, retryAfter: 12 });
    const result = await POST(request(["cycles"], {}), { params: { path: ["cycles"] } });
    expect(result.status).toBe(429); expect(result.headers.get("Retry-After")).toBe("12"); expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("rejects oversized and empty responses", async () => {
    const path = ["sessions", id, "responses"];
    for (const content of [" ", "a".repeat(4001)]) {
      expect((await POST(request(path, { content, revision: 0, requestId: id, kind: "initial" }), { params: { path } })).status).toBe(400);
    }
    expect(mocks.submit).not.toHaveBeenCalled();
  });
  it("returns in-progress status for a duplicate evaluation", async () => {
    mocks.submit.mockResolvedValue({ pending: true });
    const path = ["sessions", id, "responses"];
    expect((await POST(request(path, { content: "An answer", revision: 0, requestId: id, kind: "initial" }), { params: { path } })).status).toBe(202);
    expect(mocks.submit).toHaveBeenCalledWith(expect.anything(), "verified-owner", id, expect.objectContaining({ content: "An answer" }));
  });
});
