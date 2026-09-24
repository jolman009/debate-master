import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
  createAdmin: vi.fn(),
  adminFrom: vi.fn(),
  upsert: vi.fn(),
  billingEnabled: vi.fn(),
  createCustomer: vi.fn(),
  createCheckout: vi.fn(),
  reportError: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ auth: { getUser: mocks.getUser }, from: mocks.from }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createServiceClient: mocks.createAdmin }));
vi.mock("@/lib/stripe", () => ({
  isBillingEnabled: mocks.billingEnabled,
  getStripe: () => ({
    customers: { create: mocks.createCustomer },
    checkout: { sessions: { create: mocks.createCheckout } },
  }),
}));
vi.mock("@/lib/observability", () => ({ reportError: mocks.reportError }));

import { POST } from "./route";

function request() {
  return new Request("https://staging.example.com/api/billing/checkout", {
    method: "POST",
    // Client-provided identity must never control the privileged write.
    body: JSON.stringify({ user_id: "other-user", stripe_customer_id: "cus_forged" }),
  });
}

describe("POST /api/billing/checkout", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("STRIPE_PRICE_ID", "price_test");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.example.com");
    mocks.billingEnabled.mockReturnValue(true);
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-a", email: "a@example.com" } }, error: null });
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.createAdmin.mockReturnValue({ from: mocks.adminFrom });
    mocks.adminFrom.mockReturnValue({ upsert: mocks.upsert });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.createCustomer.mockResolvedValue({ id: "cus_new" });
    mocks.createCheckout.mockResolvedValue({ url: "https://checkout.stripe.com/test" });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("returns 503 when billing is disabled without accessing billing data", async () => {
    mocks.billingEnabled.mockReturnValue(false);
    expect((await POST(request())).status).toBe(503);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.createAdmin).not.toHaveBeenCalled();
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it.each([
    { data: { user: null }, error: null },
    { data: { user: { id: "user-a" } }, error: new Error("Invalid session") },
  ])("rejects missing or failed authentication before privileged access", async (authResult) => {
    mocks.getUser.mockResolvedValue(authResult);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.createAdmin).not.toHaveBeenCalled();
    expect(mocks.createCustomer).not.toHaveBeenCalled();
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it("reuses the authenticated owner's existing customer", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { stripe_customer_id: "cus_existing" }, error: null });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "user-a");
    expect(mocks.createCustomer).not.toHaveBeenCalled();
    expect(mocks.createAdmin).not.toHaveBeenCalled();
    expect(mocks.createCheckout).toHaveBeenCalledWith(expect.objectContaining({
      customer: "cus_existing", client_reference_id: "user-a",
    }));
  });

  it("persists a new customer through the admin client for the authenticated owner before checkout", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://checkout.stripe.com/test" });
    expect(mocks.createCustomer).toHaveBeenCalledWith({ email: "a@example.com", metadata: { userId: "user-a" } });
    expect(mocks.adminFrom).toHaveBeenCalledWith("profiles");
    expect(mocks.upsert).toHaveBeenCalledWith({
      user_id: "user-a", stripe_customer_id: "cus_new", updated_at: expect.any(String),
    }, { onConflict: "user_id" });
    expect(mocks.upsert.mock.invocationCallOrder[0]).toBeLessThan(mocks.createCheckout.mock.invocationCallOrder[0]);
    expect(mocks.createCheckout).toHaveBeenCalledWith({
      mode: "subscription", customer: "cus_new", client_reference_id: "user-a",
      line_items: [{ price: "price_test", quantity: 1 }],
      success_url: "https://staging.example.com/pricing?status=success",
      cancel_url: "https://staging.example.com/pricing?status=cancelled",
    });
  });

  it("stops on profile read errors instead of creating a replacement customer", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: new Error("Database unavailable") });
    expect((await POST(request())).status).toBe(500);
    expect(mocks.createCustomer).not.toHaveBeenCalled();
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it("checks admin configuration before creating a Stripe customer", async () => {
    mocks.createAdmin.mockImplementation(() => { throw new Error("Missing service key"); });
    expect((await POST(request())).status).toBe(500);
    expect(mocks.createCustomer).not.toHaveBeenCalled();
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it("does not open checkout when the customer mapping cannot be saved", async () => {
    const error = new Error("Billing write denied");
    mocks.upsert.mockResolvedValue({ error });
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Could not start checkout" });
    expect(mocks.createCheckout).not.toHaveBeenCalled();
    expect(mocks.reportError).toHaveBeenCalledWith(error, {
      route: "POST /api/billing/checkout", userId: "user-a",
    });
  });
});
