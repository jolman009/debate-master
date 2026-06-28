import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DebateConfig } from "@/lib/debate/types";
import { getTierForUser, startOfMonthUtc } from "@/lib/billing/tier-server";
import { isOverFreeLimit, FREE_DEBATE_LIMIT } from "@/lib/billing/tier";

export async function POST(request: Request) {
  try {
    const config: DebateConfig = await request.json();

    if (!config.topic || !config.personaId || !config.userSide) {
      return NextResponse.json(
        { error: "Missing required fields: topic, personaId, userSide" },
        { status: 400 }
      );
    }

    if (config.topic.length > 300 || (config.motion ?? "").length > 600) {
      return NextResponse.json(
        { error: "Topic or motion exceeds the maximum length" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to start a debate" },
        { status: 401 }
      );
    }

    // Free tier: cap debates per calendar month. (No-op when billing is off,
    // since getTierForUser returns "premium" then.)
    const tier = await getTierForUser(supabase, user.id);
    if (tier === "free") {
      const { count } = await supabase
        .from("debates")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", startOfMonthUtc());
      if (isOverFreeLimit(count ?? 0, tier)) {
        return NextResponse.json(
          {
            error: `You've used your ${FREE_DEBATE_LIMIT} free debates this month. Upgrade to Premium for unlimited debates.`,
            upgrade: true,
          },
          { status: 403 }
        );
      }
    }

    const { data, error } = await supabase
      .from("debates")
      .insert({
        config,
        current_stage: "opening_user",
        user_id: user.id,
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
