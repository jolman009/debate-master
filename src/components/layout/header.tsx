import { createServerClient } from "@/lib/supabase/server";
import { isTwa } from "@/lib/platform/twa-server";
import { AppNavigation } from "./app-navigation";

export async function Header() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Play policy: no purchase or steering surfaces inside the Android app.
  const inTwa = isTwa();

  return <AppNavigation email={user?.email ?? null} inTwa={inTwa} />;
}
