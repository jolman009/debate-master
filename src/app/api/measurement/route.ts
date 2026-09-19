import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { measurementEnabled } from "@/lib/measurement-flags";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const db = createServerClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!measurementEnabled(user.id)) return new Response(null, { status: 503 });
  const limit = await checkRateLimit("ai", user.id);
  if (!limit.success) return new Response(null, { status: 429 });
  const body = await request.json().catch(() => null);
  if (!body || Object.keys(body).length !== 1 || typeof body.sessionId !== "string" || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.sessionId)) {
    return NextResponse.json({ error: "Expected sessionId" }, { status: 400 });
  }
  const { error } = await db.rpc("record_coaching_view", { p_session_id: body.sessionId });
  return new Response(null, { status: error ? 404 : 204 });
}
