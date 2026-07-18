import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { createServerClient } from "@/lib/supabase/server";
import { isTwa } from "@/lib/platform/twa-server";
import { AuthMenu } from "./auth-menu";

export async function Header() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Play policy: no purchase or steering surfaces inside the Android app.
  const inTwa = isTwa();

  return (
    <header className="border-b border-stage-border px-6 py-4">
      <nav className="max-w-5xl mx-auto flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-stage-text">
          Debate<span className="text-stage-accent">Master</span>
        </Link>
        <div className="flex items-center gap-6">
          {user && (
            <>
              <Link
                href="/debate"
                className="text-sm text-stage-muted hover:text-stage-text transition-colors"
              >
                My Debates
              </Link>
              <Link
                href="/debate/new"
                className="text-sm text-stage-muted hover:text-stage-text transition-colors"
              >
                New Debate
              </Link>
            </>
          )}
          <Link
            href="/leaderboard"
            className="text-sm text-stage-muted hover:text-stage-text transition-colors"
          >
            Leaderboard
          </Link>
          {!inTwa && (
            <Link
              href="/pricing"
              className="text-sm text-stage-muted hover:text-stage-text transition-colors"
            >
              Pricing
            </Link>
          )}
          <ThemeToggle />
          <AuthMenu email={user?.email ?? null} />
        </div>
      </nav>
    </header>
  );
}
