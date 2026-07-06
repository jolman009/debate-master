import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { debateId: string } }
) {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "You must be signed in to view this debate" },
      { status: 401 }
    );
  }

  // The `user_id` filter enforces ownership. Non-owners see 404, not 403.
  const { data: debate, error: debateError } = await supabase
    .from("debates")
    .select("*")
    .eq("id", params.debateId)
    .eq("user_id", user.id)
    .single();

  if (debateError || !debate) {
    return NextResponse.json(
      { error: "Debate not found" },
      { status: 404 }
    );
  }

  const { data: turns, error: turnsError } = await supabase
    .from("debate_turns")
    .select("*")
    .eq("debate_id", params.debateId)
    .order("created_at", { ascending: true });

  if (turnsError) {
    return NextResponse.json(
      { error: "Failed to fetch turns" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { ...debate, turns: turns || [] },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
  );
}

/** Soft-delete: archive the debate so it drops off the dashboard. */
export async function DELETE(
  _request: Request,
  { params }: { params: { debateId: string } }
) {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "You must be signed in to remove a debate" },
      { status: 401 }
    );
  }

  // Explicit ownership filter — don't rely on RLS alone. If the server
  // client is ever configured with a service-role key, RLS is bypassed.
  const { error } = await supabase
    .from("debates")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", params.debateId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json(
      { error: "Failed to remove debate" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
