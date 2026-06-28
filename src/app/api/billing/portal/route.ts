import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getStripe, isBillingEnabled } from "@/lib/stripe";
import { reportError } from "@/lib/observability";

export async function POST(req: Request) {
  if (!isBillingEnabled()) {
    return NextResponse.json({ error: "Billing is not enabled." }, { status: 503 });
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const customerId = profile?.stripe_customer_id as string | undefined;
  if (!customerId) {
    return NextResponse.json(
      { error: "No subscription to manage" },
      { status: 400 }
    );
  }

  try {
    const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${base}/pricing`,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    reportError(error, { route: "POST /api/billing/portal", userId: user.id });
    return NextResponse.json(
      { error: "Could not open billing portal" },
      { status: 500 }
    );
  }
}
