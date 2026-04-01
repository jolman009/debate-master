import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { debateId: string } }
) {
  const supabase = createServerClient();

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

  return NextResponse.json(
    { ...debate, turns: turns || [] },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
  );
}
