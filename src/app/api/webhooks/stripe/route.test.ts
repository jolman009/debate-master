import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enabled: vi.fn(),
  retrieveSubscription: vi.fn(),
  retrieveSession: vi.fn(),
  createAdmin: vi.fn(),
  from: vi.fn(),
  ownerEq: vi.fn(),
  ownerResult: vi.fn(),
  update: vi.fn(),
  updateEq: vi.fn(),
  updateResult: vi.fn(),
  reportError: vi.fn(),
}));

// Exercise the installed SDK's actual signature verification, without network.
const signatureClient = new Stripe("sk_test_fixture", { apiVersion: "2025-02-24.acacia" });
const webhookSecret = "whsec_fixture_only";
vi.mock("@/lib/stripe", () => ({
  isBillingEnabled: mocks.enabled,
  getStripe: () => ({
    webhooks: signatureClient.webhooks,
    subscriptions: { retrieve: mocks.retrieveSubscription },
    checkout: { sessions: { retrieve: mocks.retrieveSession } },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createServiceClient: mocks.createAdmin }));
vi.mock("@/lib/observability", () => ({ reportError: mocks.reportError }));

import { POST } from "./route";

function request(type = "customer.subscription.updated", object: Record<string, unknown> = { id: "sub_fixture" },
  version = "2026-06-24.dahlia", secret = webhookSecret) {
  const payload = JSON.stringify({
    id: "evt_fixture", object: "event", type, api_version: version, livemode: false,
    data: { object },
  });
  return new Request("https://staging.example.com/api/webhooks/stripe", {
    method: "POST", body: payload,
    headers: { "stripe-signature": signatureClient.webhooks.generateTestHeaderString({ payload, secret }) },
  });
}

describe("Stripe webhook API-version compatibility", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", webhookSecret);
    mocks.enabled.mockReturnValue(true);
    mocks.retrieveSubscription.mockResolvedValue({
      id: "sub_fixture", customer: "cus_fixture", status: "active", current_period_end: 1900000000,
    });
    mocks.retrieveSession.mockResolvedValue({
      id: "cs_fixture", mode: "subscription", customer: "cus_fixture",
      client_reference_id: "user-a", subscription: "sub_fixture",
    });
    mocks.createAdmin.mockReturnValue({ from: mocks.from });
    const ownerQuery = { eq: mocks.ownerEq, maybeSingle: mocks.ownerResult };
    mocks.ownerEq.mockReturnValue(ownerQuery);
    mocks.ownerResult.mockResolvedValue({ data: { user_id: "user-a" }, error: null });
    const updateQuery = { eq: mocks.updateEq, select: mocks.updateResult };
    mocks.update.mockReturnValue(updateQuery);
    mocks.updateEq.mockReturnValue(updateQuery);
    mocks.updateResult.mockResolvedValue({ data: [{ user_id: "user-a" }], error: null });
    mocks.from.mockReturnValue({ select: () => ownerQuery, update: mocks.update });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("returns 503 without webhook configuration", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect((await POST(request())).status).toBe(503);
    expect(mocks.retrieveSubscription).not.toHaveBeenCalled();
  });

  it("returns 503 when billing is disabled", async () => {
    mocks.enabled.mockReturnValue(false);
    expect((await POST(request())).status).toBe(503);
    expect(mocks.createAdmin).not.toHaveBeenCalled();
  });

  it("rejects an invalid signature before provider or database access", async () => {
    expect((await POST(request(undefined, undefined, undefined, "whsec_wrong"))).status).toBe(400);
    expect(mocks.retrieveSubscription).not.toHaveBeenCalled();
    expect(mocks.createAdmin).not.toHaveBeenCalled();
  });

  it("rejects unsigned requests", async () => {
    expect((await POST(new Request("https://staging.example.com/api/webhooks/stripe", {
      method: "POST", body: "{}",
    }))).status).toBe(400);
    expect(mocks.createAdmin).not.toHaveBeenCalled();
  });

  it.each(["2025-02-24.acacia", "2026-06-24.dahlia"])(
    "uses re-fetched state for a signed %s event without a top-level period end", async (version) => {
      const response = await POST(request("customer.subscription.updated", {
        id: "sub_fixture", status: "past_due", customer: "cus_stale",
        items: { data: [{ current_period_end: 1800000000 }] },
      }, version));
      expect(response.status).toBe(200);
      expect(mocks.retrieveSubscription).toHaveBeenCalledWith("sub_fixture");
      expect(mocks.update).toHaveBeenCalledWith({
        subscription_status: "active",
        subscription_current_period_end: new Date(1900000000 * 1000).toISOString(),
        updated_at: expect.any(String),
      });
      expect(mocks.updateEq).toHaveBeenCalledWith("stripe_customer_id", "cus_fixture");
    }
  );

  it("retrieves canceled subscriptions before updating their owner's status", async () => {
    mocks.retrieveSubscription.mockResolvedValue({
      id: "sub_fixture", customer: { id: "cus_fixture" }, status: "canceled", current_period_end: 1900000000,
    });
    expect((await POST(request("customer.subscription.deleted"))).status).toBe(200);
    expect(mocks.retrieveSubscription).toHaveBeenCalledWith("sub_fixture");
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ subscription_status: "canceled" }));
  });

  it("re-fetches checkout and checks customer ownership before granting access", async () => {
    expect((await POST(request("checkout.session.completed", { id: "cs_fixture" }))).status).toBe(200);
    expect(mocks.retrieveSession).toHaveBeenCalledWith("cs_fixture");
    expect(mocks.retrieveSubscription).toHaveBeenCalledWith("sub_fixture");
    expect(mocks.ownerEq).toHaveBeenCalledWith("stripe_customer_id", "cus_fixture");
    expect(mocks.updateEq).toHaveBeenCalledWith("user_id", "user-a");
    expect(mocks.updateEq).toHaveBeenCalledWith("stripe_customer_id", "cus_fixture");
  });

  it("ignores non-subscription checkouts without granting premium", async () => {
    mocks.retrieveSession.mockResolvedValue({ mode: "payment" });
    expect((await POST(request("checkout.session.completed", { id: "cs_fixture" }))).status).toBe(200);
    expect(mocks.retrieveSubscription).not.toHaveBeenCalled();
    expect(mocks.createAdmin).not.toHaveBeenCalled();
  });

  it.each([
    { client_reference_id: "user-a", customer: "cus_fixture", subscription: null },
    { client_reference_id: null, customer: "cus_fixture", subscription: "sub_fixture" },
    { client_reference_id: "user-a", customer: "cus_other", subscription: "sub_fixture" },
  ])("does not grant access to a checkout with missing or mismatched references", async (session) => {
    mocks.retrieveSession.mockResolvedValue({ mode: "subscription", ...session });
    expect((await POST(request("checkout.session.completed", { id: "cs_fixture" }))).status).toBe(500);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it.each([null, { user_id: "user-b" }])("rejects checkout with no matching owner", async (profile) => {
    mocks.ownerResult.mockResolvedValue({ data: profile, error: null });
    expect((await POST(request("checkout.session.completed", { id: "cs_fixture" }))).status).toBe(500);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("returns 500 on owner lookup failure", async () => {
    mocks.ownerResult.mockResolvedValue({ data: null, error: new Error("Database unavailable") });
    expect((await POST(request("checkout.session.completed", { id: "cs_fixture" }))).status).toBe(500);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it.each(["customer.subscription.updated", "checkout.session.completed"])(
    "returns a retryable failure if the %s database write fails", async (type) => {
      mocks.updateResult.mockResolvedValue({ data: null, error: new Error("Write failed") });
      expect((await POST(request(type))).status).toBe(500);
      expect(mocks.reportError).toHaveBeenCalled();
    }
  );

  it.each(["customer.subscription.updated", "checkout.session.completed"])(
    "does not acknowledge %s when no owner row was updated", async (type) => {
      mocks.updateResult.mockResolvedValue({ data: [], error: null });
      expect((await POST(request(type))).status).toBe(500);
    }
  );

  it("returns 500 when subscription retrieval fails without changing entitlements", async () => {
    mocks.retrieveSubscription.mockRejectedValue(new Error("Stripe unavailable"));
    expect((await POST(request())).status).toBe(500);
    expect(mocks.createAdmin).not.toHaveBeenCalled();
  });

  it("does not store an unbounded entitlement when period end is missing", async () => {
    mocks.retrieveSubscription.mockResolvedValue({ id: "sub_fixture", customer: "cus_fixture", status: "active" });
    expect((await POST(request())).status).toBe(500);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("catches missing admin configuration and returns 500", async () => {
    mocks.createAdmin.mockImplementation(() => { throw new Error("Missing service key"); });
    expect((await POST(request())).status).toBe(500);
    expect(mocks.reportError).toHaveBeenCalled();
  });

  it("acknowledges unrelated events without provider or database writes", async () => {
    expect((await POST(request("invoice.created", { id: "in_fixture" }))).status).toBe(200);
    expect(mocks.retrieveSubscription).not.toHaveBeenCalled();
    expect(mocks.createAdmin).not.toHaveBeenCalled();
  });
});
