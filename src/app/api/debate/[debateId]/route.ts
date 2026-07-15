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

  // Load by id and let RLS scope access: AI debates are owner-only (no
  // participant rows), human debates are readable by both participants.
  // Non-authorized users (or a bad UUID) see 404, not 403.
  const { data: debate, error: debateError } = await supabase
    .from("debates")
    .select("*")
    .eq("id", params.debateId)
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

  const isOwner = debate.user_id === user.id;
  const isHuman = (debate.config as { mode?: string })?.mode === "human";

  // Human mode: surface the roster (so the client can render the opponent and
  // gate the waiting room) and the viewer's own side (to resolve "my turn").
  // The invite token is only for the owner to share.
  let participants: { user_id: string; side: string }[] = [];
  let viewerSide: string | null = null;
  if (isHuman) {
    const { data: roster } = await supabase.rpc("get_debate_participants", {
      p_debate_id: params.debateId,
    });
    participants = (roster || []).map(
      (p: { user_id: string; side: string }) => ({
        user_id: p.user_id,
        side: p.side,
      })
    );
    viewerSide = participants.find((p) => p.user_id === user.id)?.side ?? null;
  }

  return NextResponse.json(
    {
      ...debate,
      invite_token: isOwner ? debate.invite_token : null,
      turns: turns || [],
      ...(isHuman ? { participants, viewerSide } : {}),
    },
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
