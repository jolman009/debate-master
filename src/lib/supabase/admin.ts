import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses RLS. SERVER ONLY, and only for the
 * trusted server operations that must write protected fields. Callers must
 * verify authentication or provider signatures and scope writes to the
 * verified owner. Never import this into client code.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY / URL not configured");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
