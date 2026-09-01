import { createBrowserClient } from "@supabase/ssr";

/**
 * Deletes all Supabase auth cookie chunks (e.g. sb-*-auth-token.0, .1, .2, etc.)
 * from document.cookie so that old oversized session chunks don't bloat headers.
 */
export function clearStaleAuthCookies() {
  if (typeof document === "undefined") return;
  const allCookies = document.cookie.split(";");
  for (const c of allCookies) {
    const name = c.split("=")[0].trim();
    if (name.startsWith("sb-") || name.includes("auth-token")) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; max-age=0;`;
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/debate; max-age=0;`;
    }
  }
}

/**
 * Supabase client for browser use (auth forms, sign-out). Cookie-based so it
 * stays in sync with the server-side session.
 */
export function getSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
