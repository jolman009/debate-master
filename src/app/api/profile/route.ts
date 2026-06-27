import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const MAX_DISPLAY_NAME = 30;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { displayName?: string; optIn?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const displayName = (body.displayName ?? "").trim();
  const optIn = Boolean(body.optIn);

  if (optIn && !displayName) {
    return NextResponse.json(
      { error: "A display name is required to appear on the leaderboard." },
      { status: 400 }
    );
  }
  if (displayName.length > MAX_DISPLAY_NAME) {
    return NextResponse.json(
      { error: `Display name must be ${MAX_DISPLAY_NAME} characters or fewer.` },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: user.id,
      display_name: displayName || null,
      leaderboard_opt_in: optIn,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return NextResponse.json(
      { error: "Could not save profile" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
