import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const mockRpc = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createServiceClient: () => ({
    rpc: mockRpc,
  }),
}));

const mockVerifyAndAck = vi.fn();
vi.mock("@/lib/billing/google-play-server", () => ({
  getGooglePlayEnvironment: () => "test",
  getGooglePlayPackageName: () => "app.debatemaster.twa",
  verifyAndAcknowledgePlaySubscription: (args: any) => mockVerifyAndAck(args),
}));

describe("POST /api/webhooks/google-play", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockRpc.mockReset();
    mockVerifyAndAck.mockReset();
  });

  it("handles test notifications from Play Console", async () => {
    const payload = {
      version: "1.0",
      packageName: "app.debatemaster.twa",
      eventTimeMillis: "1234567890",
      testNotification: { version: "1.0" },
    };
    const b64 = Buffer.from(JSON.stringify(payload)).toString("base64");

    const req = new Request("http://localhost:3000/api/webhooks/google-play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: { data: b64, messageId: "test-message" } }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toBe(true);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("handles subscription renewal notification", async () => {
    const payload = {
      version: "1.0",
      packageName: "app.debatemaster.twa",
      eventTimeMillis: "1791504000000",
      subscriptionNotification: {
        version: "1.0",
        notificationType: 2, // RENEWED
        purchaseToken: "renewed-token",
        subscriptionId: "premium_monthly",
      },
    };
    const b64 = Buffer.from(JSON.stringify(payload)).toString("base64");

    mockVerifyAndAck.mockResolvedValue({
      valid: true,
      active: true,
      periodEnd: "2026-11-09T00:00:00.000Z",
    });
    mockRpc.mockResolvedValue({ data: "processed", error: null });

    const req = new Request("http://localhost:3000/api/webhooks/google-play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: { data: b64, messageId: "renewal-message" } }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("active");
    expect(mockRpc).toHaveBeenCalledWith(
      "reconcile_google_play_event",
      expect.objectContaining({
        p_purchase_token: "renewed-token",
        p_status: "active",
        p_period_end: "2026-11-09T00:00:00.000Z",
      })
    );
  });

  it("handles subscription expiration notification", async () => {
    const payload = {
      version: "1.0",
      packageName: "app.debatemaster.twa",
      eventTimeMillis: "1791504000000",
      subscriptionNotification: {
        version: "1.0",
        notificationType: 13, // EXPIRED
        purchaseToken: "expired-token",
        subscriptionId: "premium_monthly",
      },
    };
    const b64 = Buffer.from(JSON.stringify(payload)).toString("base64");

    mockVerifyAndAck.mockResolvedValue({
      valid: true,
      active: false,
      periodEnd: "2026-09-08T00:00:00.000Z",
    });
    mockRpc.mockResolvedValue({ data: "processed", error: null });

    const req = new Request("http://localhost:3000/api/webhooks/google-play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: { data: b64, messageId: "expiry-message" } }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("canceled");
    expect(mockRpc).toHaveBeenCalledWith(
      "reconcile_google_play_event",
      expect.objectContaining({
        p_purchase_token: "expired-token",
        p_status: "canceled",
      })
    );
  });
});
