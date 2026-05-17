"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * Header auth control: shows the signed-in email + sign-out, or a sign-in
 * link. `email` is resolved server-side and passed in by the Header.
 */
export function AuthMenu({ email }: { email: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (!email) {
    return (
      <Link
        href="/login"
        className="text-sm text-stage-muted transition-colors hover:text-stage-text"
      >
        Sign in
      </Link>
    );
  }

  async function signOut() {
    setLoading(true);
    await getSupabaseClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <span
        className="hidden max-w-[12rem] truncate text-sm text-stage-muted sm:inline"
        title={email}
      >
        {email}
      </span>
      <button
        type="button"
        onClick={signOut}
        disabled={loading}
        className="text-sm text-stage-muted transition-colors hover:text-stage-text disabled:opacity-50"
      >
        {loading ? "…" : "Sign out"}
      </button>
    </div>
  );
}
