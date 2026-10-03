import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/observability";

export async function POST(req: NextRequest) {
  try {
    const auth = createServerClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in to rate coaching." }, { status: 401 });
    const limit = await checkRateLimit("ai", user.id);
    if (!limit.success) return NextResponse.json({ error: "Please wait before trying again." }, { status: 429 });
    const body = await req.json().catch(() => null);
    if (!body || !["helpful", "not_helpful", "reported"].includes(body.usefulness)) {
      return NextResponse.json({ error: "Invalid usefulness rating" }, { status: 400 });
    }
    if (typeof body.sessionId !== "string" || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.sessionId)) {
      return NextResponse.json({ error: "Expected debate ID" }, { status: 400 });
    }
    const { data: debate, error: readError } = await auth.from("debates").select("id,feedback")
      .eq("id", body.sessionId).eq("user_id", user.id).maybeSingle();
    if (readError) throw new Error("Read failed");
    if (!debate?.feedback) return NextResponse.json({ error: "Coaching not found" }, { status: 404 });
    const { error } = await createServiceClient().from("coaching_usefulness").upsert({
      user_id: user.id, debate_id: debate.id, rating: body.usefulness,
      updated_at: new Date().toISOString(), reviewed_at: null, review_disposition: null,
    }, { onConflict: "user_id,debate_id" });
    if (error) throw new Error("Write failed");
    return NextResponse.json({ success: true });
  } catch {
    reportError(new Error("Failed to record coaching usefulness"), { route: "feedback/usefulness" });
    return NextResponse.json({ error: "Failed to record feedback signal" }, { status: 500 });
  }
}
