import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DebateConfig } from "@/lib/debate/types";
import { getTierForUser, startOfMonthUtc } from "@/lib/billing/tier-server";
import { FREE_DEBATE_LIMIT } from "@/lib/billing/tier";
import { reportError } from "@/lib/observability";

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

    const tier = await getTierForUser(supabase, user.id);
    // Premium users bypass the cap. See migration 009 for the RPC contract:
    // a negative limit means "skip the check entirely".
    const freeLimit = tier === "free" ? FREE_DEBATE_LIMIT : -1;

    // Atomic count-and-insert. The RPC takes a per-user advisory lock so
    // two concurrent create calls cannot both slip past the cap.
    const { data: rows, error } = await supabase.rpc(
      "create_debate_with_limit",
      {
        p_user_id: user.id,
        p_config: config,
        p_free_limit: freeLimit,
        p_month_start: startOfMonthUtc(),
      }
    );

    if (error) {
      reportError(error, { route: "debate/create" });
      return NextResponse.json(
        { error: "Failed to create debate" },
        { status: 500 }
      );
    }

    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) {
      reportError(new Error("RPC returned no row"), { route: "debate/create" });
      return NextResponse.json(
        { error: "Failed to create debate" },
        { status: 500 }
      );
    }

    if (row.over_limit) {
      return NextResponse.json(
        {
          error: `You have used your ${FREE_DEBATE_LIMIT} free debates this month. Upgrade to Premium for unlimited debates.`,
          upgrade: true,
        },
        { status: 403 }
      );
    }

    return NextResponse.json({ debateId: row.debate_id });
  } catch (err) {
    reportError(err, { route: "debate/create", phase: "parse" });
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
