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

  // Active cleanup: if user_metadata has a legacy bloated data URL, clear it so cookies shrink
  if (
    typeof user.user_metadata?.avatar_url === "string" &&
    user.user_metadata.avatar_url.startsWith("data:")
  ) {
    await supabase.auth
      .updateUser({ data: { avatar_url: null } })
      .catch(() => {});
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, leaderboard_opt_in, avatar_url")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    displayName:
      profile?.display_name ??
      (user.user_metadata?.display_name as string | undefined) ??
      null,
    optIn: profile?.leaderboard_opt_in ?? false,
    avatarUrl: profile?.avatar_url ?? null,
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

  const displayName =
    body.displayName !== undefined ? (body.displayName ?? "").trim() : undefined;
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

  const { error } = await supabase
    .from("profiles")
    .upsert(updates, { onConflict: "user_id" });

  if (error) {
    console.error("Failed to update profile:", error);
    return NextResponse.json(
      { error: "Failed to save profile changes" },
      { status: 500 }
    );
  }

  // Update user_metadata for display_name ONLY.
  // NEVER put base64 data URLs into user_metadata because Supabase serializes
  // user_metadata into the auth JWT cookie, causing 494 / 431 REQUEST_HEADER_TOO_LARGE.
  const metadataUpdates: Record<string, unknown> = {};
  if (displayName !== undefined) {
    metadataUpdates.display_name = displayName || null;
  }
  // Clear any existing bloated avatar data URL from metadata cookie
  if (
    avatarUrl === null ||
    (typeof user.user_metadata?.avatar_url === "string" &&
      user.user_metadata.avatar_url.startsWith("data:"))
  ) {
    metadataUpdates.avatar_url = null;
  } else if (
    typeof avatarUrl === "string" &&
    !avatarUrl.startsWith("data:") &&
    avatarUrl.length < 500
  ) {
    metadataUpdates.avatar_url = avatarUrl;
  }

  if (Object.keys(metadataUpdates).length > 0) {
    await supabase.auth.updateUser({ data: metadataUpdates }).catch(() => {});
  }

  return NextResponse.json({ ok: true, avatarUrl });
}
