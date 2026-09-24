import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { getStripe, isBillingEnabled } from "@/lib/stripe";
import { reportError } from "@/lib/observability";

function appUrl(req: Request): string {
  return process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
}

export async function POST(req: Request) {
  if (!isBillingEnabled()) {
    return NextResponse.json({ error: "Billing is not enabled." }, { status: 503 });
  }

  const supabase = createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const stripe = getStripe();

    // Reuse the user's Stripe customer if they have one; else create + store it.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    let customerId = profile?.stripe_customer_id as string | undefined;
    if (!customerId) {
      // Migration 016 reserves billing fields for trusted server writes.
      // Resolve this client before creating a customer so missing server
      // configuration cannot leave an orphaned Stripe customer.
      const admin = createServiceClient();
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      const { error: saveError } = await admin.from("profiles").upsert(
        {
          user_id: user.id,
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      if (saveError) throw saveError;
    }

    const base = appUrl(req);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
      success_url: `${base}/pricing?status=success`,
      cancel_url: `${base}/pricing?status=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    reportError(error, { route: "POST /api/billing/checkout", userId: user.id });
    return NextResponse.json(
      { error: "Could not start checkout" },
      { status: 500 }
    );
  }
}
