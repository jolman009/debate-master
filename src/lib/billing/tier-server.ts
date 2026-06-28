import type { SupabaseClient } from "@supabase/supabase-js";
import { isBillingEnabled } from "@/lib/stripe";
import { resolveTier, Tier } from "./tier";

/**
 * Resolve the tier for a signed-in user using their profile's subscription
 * state. Returns "premium" immediately when billing is disabled.
 */
export async function getTierForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<Tier> {
  if (!isBillingEnabled()) return "premium";

  const { data } = await supabase
    .from("profiles")
    .select("subscription_status, subscription_current_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  return resolveTier({
    billingEnabled: true,
    status: data?.subscription_status,
    periodEnd: data?.subscription_current_period_end,
    now: new Date(),
  });
}

/** Start of the current calendar month (UTC), for the free debate cap. */
export function startOfMonthUtc(now = new Date()): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  ).toISOString();
}
