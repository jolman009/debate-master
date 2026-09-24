import Stripe from "stripe";

/**
 * Billing is enabled only when the core Stripe env vars are present. When
 * disabled, the app behaves exactly as before (no gating) — see resolveTier.
 */
export function isBillingEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
}

let client: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  // Keep retrieved resources compatible with this SDK's generated types.
  // Webhook destinations can use a newer version; handlers re-fetch resources.
  if (!client) client = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
  return client;
}
