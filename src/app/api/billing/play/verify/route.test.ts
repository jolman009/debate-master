import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

// Mock Supabase
const mockGetUser = vi.fn();
const mockUpsert = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createServiceClient: () => ({
    from: () => ({
      upsert: mockUpsert,
    }),
  }),
}));

// Mock Google Play server
const mockVerifyAndAck = vi.fn();
const mockIsConfigured = vi.fn();

vi.mock("@/lib/billing/google-play-server", () => ({
  isGooglePlayConfigured: () => mockIsConfigured(),
  verifyAndAcknowledgePlaySubscription: (args: any) => mockVerifyAndAck(args),
}));

describe("POST /api/billing/play/verify", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockGetUser.mockReset();
    mockUpsert.mockReset();
    mockVerifyAndAck.mockReset();
    mockIsConfigured.mockReset();
  });

  it("returns 401 if user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const req = new Request("http://localhost:3000/api/billing/play/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku: "premium_monthly", purchaseToken: "tok-123" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 if sku or purchaseToken are missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const req = new Request("http://localhost:3000/api/billing/play/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku: "premium_monthly" }), // missing purchaseToken
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("fails closed when Play verification is unconfigured", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockIsConfigured.mockReturnValue(false);
    const response = await POST(new Request("http://localhost/api/billing/play/verify", {
      method: "POST", body: JSON.stringify({ sku: "premium_monthly", purchaseToken: "unverified" }),
    }));
    expect(response.status).toBe(503);
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockVerifyAndAck).not.toHaveBeenCalled();
  });

  it("does not claim activation when entitlement storage fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockIsConfigured.mockReturnValue(true);
    mockVerifyAndAck.mockResolvedValue({ valid: true, active: true, periodEnd: "2026-10-09T00:00:00Z" });
    mockUpsert.mockResolvedValue({ error: new Error("Storage unavailable") });
    const response = await POST(new Request("http://localhost/api/billing/play/verify", {
      method: "POST", body: JSON.stringify({ sku: "premium_monthly", purchaseToken: "verified-token" }),
    }));
    expect(response.status).toBe(500);
    expect((await response.json()).success).toBeUndefined();
  });

  it("activates subscription and updates profile when verification succeeds", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockIsConfigured.mockReturnValue(true);
    mockVerifyAndAck.mockResolvedValue({
      valid: true,
      active: true,
      periodEnd: "2026-10-09T00:00:00.000Z",
      orderId: "GPA.1234-5678",
    });
    mockUpsert.mockResolvedValue({ error: null });

    const req = new Request("http://localhost:3000/api/billing/play/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sku: "premium_monthly",
        purchaseToken: "valid-token-xyz",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.periodEnd).toBe("2026-10-09T00:00:00.000Z");

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        subscription_status: "active",
        subscription_current_period_end: "2026-10-09T00:00:00.000Z",
      }),
      { onConflict: "user_id" }
    );
  });

  it("returns 400 when Google Play reports subscription is invalid or inactive", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockIsConfigured.mockReturnValue(true);
    mockVerifyAndAck.mockResolvedValue({
      valid: false,
      active: false,
      error: "Subscription expired",
    });

    const req = new Request("http://localhost:3000/api/billing/play/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sku: "premium_monthly",
        purchaseToken: "expired-token",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Subscription expired");
  });
});
