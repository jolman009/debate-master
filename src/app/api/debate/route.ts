import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DebateConfig } from "@/lib/debate/types";

export async function POST(request: Request) {
  try {
    const config: DebateConfig = await request.json();

    if (!config.topic || !config.personaId || !config.userSide) {
      return NextResponse.json(
        { error: "Missing required fields: topic, personaId, userSide" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("debates")
      .insert({
        config,
        current_stage: "opening_user",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to create debate:", error);
      return NextResponse.json(
        { error: "Failed to create debate" },
        { status: 500 }
      );
    }

    return NextResponse.json({ debateId: data.id });
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
