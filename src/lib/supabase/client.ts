import { createBrowserClient } from "@supabase/ssr";

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
