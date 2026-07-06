import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/** Enable sharing — generate a share token if the debate doesn't have one. */
export async function POST(
  _request: Request,
  { params }: { params: { debateId: string } }
) {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Explicit ownership filter — defense in depth, don't lean on RLS alone.
  const { data: existing } = await supabase
    .from("debates")
    .select("share_token")
    .eq("id", params.debateId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Debate not found" }, { status: 404 });
  }

  let shareToken = existing.share_token as string | null;
  if (!shareToken) {
    shareToken = crypto.randomUUID();
    const { error } = await supabase
      .from("debates")
      .update({ share_token: shareToken })
      .eq("id", params.debateId)
      .eq("user_id", user.id);
    if (error) {
      return NextResponse.json(
        { error: "Failed to enable sharing" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ shareToken });
}

/** Revoke sharing — the share link stops working immediately. */
export async function DELETE(
  _request: Request,
  { params }: { params: { debateId: string } }
) {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { error } = await supabase
    .from("debates")
    .update({ share_token: null })
    .eq("id", params.debateId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json(
      { error: "Failed to revoke sharing" },
      { status: 500 }
    );
  }

  return NextResponse.json({ shareToken: null });
}
