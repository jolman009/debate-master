import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Store authoritative Stripe state before recomputing the combined entitlement. */
export async function reconcileStripeEntitlement(
  admin: SupabaseClient,
  userId: string,
  subscription: Stripe.Subscription,
) {
  const customer = typeof subscription.customer === "string"
    ? subscription.customer : subscription.customer.id;
  const product = subscription.items?.data?.[0]?.price?.id;
  if (!customer || !product || !Number.isFinite(subscription.current_period_end)) {
    throw new Error("Incomplete verified Stripe subscription");
  }
  const now = new Date().toISOString();
  const { error } = await admin.from("billing_subscriptions").upsert({
    user_id: userId,
    provider: "stripe",
    provider_environment: subscription.livemode ? "live" : "test",
    provider_subscription_id: subscription.id,
    provider_customer_id: customer,
    product_id: product,
    status: subscription.status,
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    provider_updated_at: now,
    verified_at: now,
  }, { onConflict: "provider,provider_environment,provider_subscription_id" });
  if (error) throw error;
  const { error: refreshError } = await admin.rpc("refresh_billing_entitlement", { p_user_id: userId });
  if (refreshError) throw refreshError;
}
