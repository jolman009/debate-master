import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const MAX_DISPLAY_NAME = 30;

export async function GET() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, leaderboard_opt_in, avatar_url")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    displayName: profile?.display_name ?? (user.user_metadata?.display_name as string | undefined) ?? null,
    optIn: profile?.leaderboard_opt_in ?? false,
    avatarUrl: profile?.avatar_url ?? (user.user_metadata?.avatar_url as string | undefined) ?? null,
  });
}

export async function POST(req: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { displayName?: string; optIn?: boolean; avatarUrl?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const displayName = body.displayName !== undefined ? (body.displayName ?? "").trim() : undefined;
  const optIn = body.optIn !== undefined ? Boolean(body.optIn) : undefined;
  const avatarUrl = body.avatarUrl !== undefined ? body.avatarUrl : undefined;

  if (optIn && !displayName) {
    return NextResponse.json(
      { error: "A display name is required to appear on the leaderboard." },
      { status: 400 }
    );
  }
  if (displayName && displayName.length > MAX_DISPLAY_NAME) {
    return NextResponse.json(
      { error: `Display name must be ${MAX_DISPLAY_NAME} characters or fewer.` },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };
  if (displayName !== undefined) updates.display_name = displayName || null;
  if (optIn !== undefined) updates.leaderboard_opt_in = optIn;
  if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;

  const { error } = await supabase.from("profiles").upsert(
    updates,
    { onConflict: "user_id" }
  );

  // Also sync user_metadata so the Supabase session carries it
  const metadataUpdates: Record<string, unknown> = {};
  if (displayName !== undefined) metadataUpdates.display_name = displayName || null;
  if (avatarUrl !== undefined) metadataUpdates.avatar_url = avatarUrl;
  if (Object.keys(metadataUpdates).length > 0) {
    await supabase.auth.updateUser({ data: metadataUpdates }).catch(() => {});
  }

  if (error) {
    // If profiles table column update failed, user_metadata was already updated as fallback
    return NextResponse.json({ ok: true, avatarUrl, fallback: true });
  }

  return NextResponse.json({ ok: true, avatarUrl });
}
