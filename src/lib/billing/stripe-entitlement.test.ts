import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reconcileStripeEntitlement } from "./stripe-entitlement";

const subscription = {
  id: "sub_fixture", customer: "cus_fixture", livemode: true,
  status: "active", current_period_end: 1900000000, cancel_at_period_end: false,
  items: { data: [{ price: { id: "price_fixture" } }] },
} as Stripe.Subscription;

function fixture(error: object | null = null) {
  const upsert = vi.fn().mockResolvedValue({ error });
  const rpc = vi.fn().mockResolvedValue({ error: null });
  const admin = { from: vi.fn().mockReturnValue({ upsert }), rpc } as unknown as SupabaseClient;
  return { admin, upsert, rpc };
}

describe("Stripe and Google Play combined entitlement", () => {
  it("stores verified Stripe state and refreshes the owner across providers", async () => {
    const f = fixture();
    await reconcileStripeEntitlement(f.admin, "user_fixture", subscription);
    expect(f.upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "user_fixture", provider: "stripe", provider_environment: "live",
      provider_subscription_id: "sub_fixture", product_id: "price_fixture",
      current_period_end: new Date(1900000000 * 1000).toISOString(),
    }), expect.any(Object));
    expect(f.rpc).toHaveBeenCalledWith("refresh_billing_entitlement", { p_user_id: "user_fixture" });
  });
  it("does not refresh entitlement when ownership storage fails", async () => {
    const f = fixture({ message: "Ownership conflict" });
    await expect(reconcileStripeEntitlement(f.admin, "user_fixture", subscription)).rejects.toEqual({ message: "Ownership conflict" });
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("propagates a failed refresh so the webhook can retry", async () => {
    const f = fixture();
    f.rpc.mockResolvedValue({ error: { message: "Unavailable" } });
    await expect(reconcileStripeEntitlement(f.admin, "user_fixture", subscription)).rejects.toEqual({ message: "Unavailable" });
  });
});
