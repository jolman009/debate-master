import { createServerClient } from "@/lib/supabase/server";
import { isTwa } from "@/lib/platform/twa-server";
import { AppNavigation } from "./app-navigation";

export async function Header() {
  let user = null;
  let avatarUrl: string | null = null;
  try {
    const supabase = createServerClient();
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      avatarUrl = profile?.avatar_url ?? null;
    }
  } catch {
    user = null;
  }

  // Play policy: no purchase or steering surfaces inside the Android app.
  const inTwa = isTwa();

  return (
    <AppNavigation
      email={user?.email ?? null}
      initialAvatarUrl={avatarUrl}
      inTwa={inTwa}
    />
  );
}
