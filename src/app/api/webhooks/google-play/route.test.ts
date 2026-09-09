import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const mockUpdate = vi.fn();
const mockEq = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createServiceClient: () => ({
    from: () => ({
      update: (...args: any[]) => {
        mockUpdate(...args);
        return { eq: mockEq };
      },
    }),
  }),
}));

const mockVerifyAndAck = vi.fn();
vi.mock("@/lib/billing/google-play-server", () => ({
  verifyAndAcknowledgePlaySubscription: (args: any) => mockVerifyAndAck(args),
}));

describe("POST /api/webhooks/google-play", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockUpdate.mockReset();
    mockEq.mockReset();
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
      body: JSON.stringify({ message: { data: b64 } }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toBe(true);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("handles subscription renewal notification", async () => {
    const payload = {
      version: "1.0",
      packageName: "app.debatemaster.twa",
      eventTimeMillis: "1234567890",
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
    mockEq.mockResolvedValue({ error: null });

    const req = new Request("http://localhost:3000/api/webhooks/google-play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: { data: b64 } }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("active");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_status: "active",
        subscription_current_period_end: "2026-11-09T00:00:00.000Z",
      })
    );
  });

  it("handles subscription expiration notification", async () => {
    const payload = {
      version: "1.0",
      packageName: "app.debatemaster.twa",
      eventTimeMillis: "1234567890",
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
    mockEq.mockResolvedValue({ error: null });

    const req = new Request("http://localhost:3000/api/webhooks/google-play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: { data: b64 } }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("canceled");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_status: "canceled",
      })
    );
  });
});
