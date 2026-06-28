// Pure tier logic — no server/Supabase imports, so it is unit-testable.

export type Tier = "free" | "premium";

export const FREE_DEBATE_LIMIT = 3;

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

/**
 * Resolve a user's tier.
 *
 * When billing isn't configured, NO ONE is gated — everyone resolves to
 * "premium" so the app behaves exactly as it did before Stripe was added.
 * Once billing is on, only an active/trialing subscription that hasn't lapsed
 * counts as premium.
 */
export function resolveTier(input: {
  billingEnabled: boolean;
  status: string | null | undefined;
  periodEnd: string | null | undefined;
  now: Date;
}): Tier {
  if (!input.billingEnabled) return "premium";
  if (!input.status || !ACTIVE_STATUSES.has(input.status)) return "free";
  if (input.periodEnd && new Date(input.periodEnd).getTime() < input.now.getTime()) {
    return "free";
  }
  return "premium";
}

/** True when a free user has reached the monthly debate cap. */
export function isOverFreeLimit(monthDebateCount: number, tier: Tier): boolean {
  return tier === "free" && monthDebateCount >= FREE_DEBATE_LIMIT;
}
