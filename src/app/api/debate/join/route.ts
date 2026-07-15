import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/observability";

// POST { token } → claim the open side of a human debate via its invite link.
// The heavy lifting (validate token, assert human mode, lock, claim side) is in
// the join_debate_via_invite SECURITY DEFINER function (migration 010).
export async function POST(request: Request) {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "You must be signed in to join a debate" },
      { status: 401 }
    );
  }

  let token: string | undefined;
  try {
    ({ token } = await request.json());
  } catch {
    // handled below
  }

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Missing invite token" }, { status: 400 });
  }

  const { data: debateId, error } = await supabase.rpc(
    "join_debate_via_invite",
    { p_token: token }
  );

  if (error) {
    // The RPC raises friendly messages for the expected cases (invalid link,
    // full debate, wrong mode). Surface those; log anything unexpected.
    const message = error.message || "Could not join this debate";
    const known =
      /invalid invite|already full|human debate|not authenticated/i.test(message);
    if (!known) {
      reportError(error, { route: "debate/join" });
    }
    return NextResponse.json(
      { error: known ? message : "Could not join this debate" },
      { status: known ? 400 : 500 }
    );
  }

  if (!debateId) {
    return NextResponse.json(
      { error: "Could not join this debate" },
      { status: 400 }
    );
  }

  return NextResponse.json({ debateId });
}
