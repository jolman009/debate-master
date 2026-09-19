import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  verifyAndAcknowledgePlaySubscription,
  isGooglePlayConfigured,
} from "@/lib/billing/google-play-server";
import { reportError } from "@/lib/observability";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json(
      { error: "You must be signed in to verify a subscription." },
      { status: 401 }
    );
  }

  let body: { sku?: string; purchaseToken?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sku, purchaseToken } = body;
  if (!sku || !purchaseToken) {
    return Response.json(
      { error: "Both 'sku' and 'purchaseToken' are required." },
      { status: 400 }
    );
  }

  // Missing verification credentials must never create a paid entitlement.
  if (!isGooglePlayConfigured()) {
    return Response.json(
      { error: "Google Play verification is not configured." },
      { status: 503 }
    );
  }

  try {
    const result = await verifyAndAcknowledgePlaySubscription({
      subscriptionId: sku,
      purchaseToken,
    });

    if (!result.valid || !result.active) {
      return Response.json(
        {
          error:
            result.error ||
            "Subscription is inactive or invalid according to Google Play.",
        },
        { status: 400 }
      );
    }

    const admin = createServiceClient();
    const { error: saveError } = await admin.from("profiles").upsert(
      {
        user_id: user.id,
        subscription_status: "active",
        subscription_current_period_end: result.periodEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (saveError) throw saveError;

    return Response.json({
      success: true,
      active: true,
      periodEnd: result.periodEnd,
    });
  } catch (err) {
    reportError(err, { route: "api/billing/play/verify" });
    return Response.json(
      { error: "Internal error verifying subscription." },
      { status: 500 }
    );
  }
}
