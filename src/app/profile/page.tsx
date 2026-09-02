import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { isTwa } from "@/lib/platform/twa-server";
import { ProfileView } from "./profile-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Account Settings & Data Management | Debate Master",
  description: "Manage your profile, preferences, data, and account deletion in Debate Master.",
};

export default async function ProfilePage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/profile");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, leaderboard_opt_in, avatar_url, subscription_status")
    .eq("user_id", user.id)
    .maybeSingle();

  // Count user debates and custom personas for transparent data inventory
  const { count: debatesCount } = await supabase
    .from("debates")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { count: personasCount } = await supabase
    .from("custom_personas")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  return (
    <ProfileView
      user={{
        id: user.id,
        email: user.email || "",
        displayName: profile?.display_name || "",
        optIn: profile?.leaderboard_opt_in ?? false,
        avatarUrl: profile?.avatar_url || null,
        isPremium: profile?.subscription_status === "active",
      }}
      counts={{
        debates: debatesCount ?? 0,
        personas: personasCount ?? 0,
      }}
      inTwa={isTwa()}
    />
  );
}
