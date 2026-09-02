import { createServerClient } from "@/lib/supabase/server";
import { isTwa } from "@/lib/platform/twa-server";
import { isBillingEnabled } from "@/lib/stripe";
import { getTierForUser } from "@/lib/billing/tier-server";
import { PricingPlans } from "@/components/billing/pricing-plans";

export const metadata = {
  title: "Pricing & Plans · Debate Master",
  description: "Debate for free or upgrade to Premium for studio neural voices and deep AI rubric analysis.",
};

export default async function PricingPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const billingEnabled = isBillingEnabled();
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const tier = user && billingEnabled ? await getTierForUser(supabase, user.id) : "free";
  const isPremium = billingEnabled && tier === "premium";

  // Play policy: inside the Android app this page is informational only — no
  // checkout, no billing portal, and nothing that points at the web to pay.
  // Premium unlocked on the web still works here; we just don't sell it.
  const inTwa = isTwa();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-stage-text sm:text-4xl">
          {inTwa ? "Membership Plans" : "Simple, Transparent Pricing"}
        </h1>
        <p className="mt-2 text-base text-stage-muted max-w-xl mx-auto">
          {inTwa
            ? "Explore features included with Free and Premium tiers."
            : "Sharpen your critical thinking for free, or unlock studio neural audio and deep coaching with Premium."}
        </p>
      </div>

      {searchParams.status === "success" && (
        <div className="mt-6 rounded-xl border border-stage-accent/40 bg-stage-accent/10 p-4 text-center text-sm font-medium text-stage-accent">
          🎉 You&apos;re now on Premium! Thank you for subscribing. Your account benefits are active.
        </div>
      )}
      {searchParams.status === "cancelled" && (
        <div className="mt-6 rounded-xl border border-stage-border bg-stage-surface p-4 text-center text-sm text-stage-muted">
          Checkout was cancelled — no charges were made.
        </div>
      )}

      <PricingPlans
        isPremium={isPremium}
        inTwa={inTwa}
        billingEnabled={billingEnabled}
        hasUser={!!user}
      />
    </div>
  );
}
