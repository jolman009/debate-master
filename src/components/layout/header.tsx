import { createServerClient } from "@/lib/supabase/server";
import { isTwa } from "@/lib/platform/twa-server";
import { resolveTier } from "@/lib/billing/tier";
import { isBillingEnabled } from "@/lib/stripe";
import { AppNavigation } from "./app-navigation";

export async function Header() {
  let user = null;
  let avatarUrl: string | null = null;
  let isPremium = false;
  try {
    const supabase = createServerClient();
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("avatar_url, subscription_status, subscription_current_period_end")
        .eq("user_id", user.id)
        .maybeSingle();
      avatarUrl = profile?.avatar_url ?? null;
      isPremium = isBillingEnabled() && resolveTier({
        billingEnabled: true,
        status: profile?.subscription_status,
        periodEnd: profile?.subscription_current_period_end,
        now: new Date(),
      }) === "premium";
    }
  } catch {
    user = null;
  }

  // Pricing chooses native Play Billing inside the Android app.
  const inTwa = isTwa();

  return (
    <AppNavigation
      email={user?.email ?? null}
      initialAvatarUrl={avatarUrl}
      isPremium={isPremium}
      inTwa={inTwa}
    />
  );
}
