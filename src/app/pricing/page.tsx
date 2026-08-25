import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { isTwa } from "@/lib/platform/twa-server";
import { isBillingEnabled } from "@/lib/stripe";
import { getTierForUser } from "@/lib/billing/tier-server";
import { FREE_DEBATE_LIMIT } from "@/lib/billing/tier";
import { UpgradeButton } from "@/components/billing/upgrade-button";
import { ManageButton } from "@/components/billing/manage-button";

export const metadata = {
  title: "Pricing · Debate Master",
};

const FREE_FEATURES = [
  "Browser text-to-speech voices",
  `${FREE_DEBATE_LIMIT} debates per month`,
  "All built-in & custom personas",
  "Topic packs & leaderboard",
];

const PREMIUM_FEATURES = [
  "Everything in Free",
  "ElevenLabs realistic voices",
  "Unlimited debates",
];

function Check() {
  return <span className="mr-2 text-stage-accent">✓</span>;
}

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
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-stage-text">
        {inTwa ? "Plans" : "Pricing"}
      </h1>
      <p className="mt-0.5 text-sm text-stage-muted">
        {inTwa
          ? "What's included in each plan."
          : "Debate for free, or go Premium for realistic voices and unlimited debates."}
      </p>

      {searchParams.status === "success" && (
        <div className="mt-4 rounded-lg border border-stage-accent/40 bg-stage-accent/10 px-4 py-3 text-sm text-stage-accent">
          You&apos;re Premium — thanks for subscribing! It may take a moment to
          activate.
        </div>
      )}
      {searchParams.status === "cancelled" && (
        <div className="mt-4 rounded-lg border border-stage-border px-4 py-3 text-sm text-stage-muted">
          Checkout cancelled — no charge was made.
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Free */}
        <div className="debate-card p-5">
          <h2 className="text-lg font-bold text-stage-text">Free</h2>
          <p className="mt-1 text-2xl font-bold text-stage-text">
            $0<span className="text-sm font-normal text-stage-muted">/mo</span>
          </p>
          <ul className="mt-4 space-y-2 text-sm text-stage-muted">
            {FREE_FEATURES.map((f) => (
              <li key={f}>
                <Check />
                {f}
              </li>
            ))}
          </ul>
          {!isPremium && (
            <p className="mt-5 text-xs text-stage-muted">Your current plan</p>
          )}
        </div>

        {/* Premium */}
        <div className="debate-card border-stage-accent p-5">
          <h2 className="text-lg font-bold text-stage-text">Premium</h2>
          <p className="mt-1 text-2xl font-bold text-stage-text">
            Premium
            <span className="text-sm font-normal text-stage-muted"> plan</span>
          </p>
          <ul className="mt-4 space-y-2 text-sm text-stage-muted">
            {PREMIUM_FEATURES.map((f) => (
              <li key={f}>
                <Check />
                {f}
              </li>
            ))}
          </ul>

          <div className="mt-5">
            {inTwa ? (
              // Informational only — no CTA of any kind.
              isPremium && (
                <p className="text-sm font-medium text-stage-accent">
                  You&apos;re on Premium ✓
                </p>
              )
            ) : !billingEnabled ? (
              <p className="text-sm text-stage-muted">
                Premium isn&apos;t available yet — check back soon.
              </p>
            ) : !user ? (
              <Link href="/login?redirect=/pricing" className="btn-primary inline-block px-5 py-2.5">
                Sign in to upgrade
              </Link>
            ) : isPremium ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-stage-accent">
                  You&apos;re on Premium ✓
                </p>
                <ManageButton />
              </div>
            ) : (
              <UpgradeButton />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
