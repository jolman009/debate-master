// Google Cloud Pub/Sub push endpoint for Google Play Real-Time Developer Notifications (RTDN).

import { createServiceClient } from "@/lib/supabase/admin";
import {
  getGooglePlayEnvironment,
  getGooglePlayPackageName,
  verifyAndAcknowledgePlaySubscription,
} from "@/lib/billing/google-play-server";
import { reportError } from "@/lib/observability";
import { authenticateGooglePlayPush } from "@/lib/billing/google-play-push-auth";

export const dynamic = "force-dynamic";

interface PubSubPushBody {
  message?: {
    data?: string;
    messageId?: string;
    publishTime?: string;
  };
  subscription?: string;
}

interface PlayDeveloperNotification {
  version: string;
  packageName: string;
  eventTimeMillis: string;
  subscriptionNotification?: {
    version: string;
    notificationType: number;
    purchaseToken: string;
    subscriptionId: string;
  };
  testNotification?: {
    version: string;
  };
}

// Notification types reference:
// 1: SUBSCRIPTION_RECOVERED
// 2: SUBSCRIPTION_RENEWED
// 3: SUBSCRIPTION_CANCELED
// 4: SUBSCRIPTION_PURCHASED
// 5: SUBSCRIPTION_ON_HOLD
// 6: SUBSCRIPTION_IN_GRACE_PERIOD
// 7: SUBSCRIPTION_RESTARTED
// 8: SUBSCRIPTION_PRICE_CHANGE_CONFIRMED
// 9: SUBSCRIPTION_DEFERRED
// 10: SUBSCRIPTION_PAUSED
// 11: SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED
// 12: SUBSCRIPTION_REVOKED
// 13: SUBSCRIPTION_EXPIRED

export async function POST(req: Request) {
  const denied = await authenticateGooglePlayPush(req);
  if (denied) return denied;

  let body: PubSubPushBody;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!body.message?.data) {
    return new Response("Missing message data", { status: 400 });
  }

  if (!body.message.messageId) {
    return new Response("Missing message ID", { status: 400 });
  }

  let notification: PlayDeveloperNotification;
  try {
    const decoded = Buffer.from(body.message.data, "base64").toString("utf8");
    notification = JSON.parse(decoded);
  } catch (err) {
    return new Response("Malformed base64 payload", { status: 400 });
  }

  if (notification.packageName !== getGooglePlayPackageName()) {
    return new Response("Unexpected package name", { status: 400 });
  }

  // Handle Google Play Console Test Notifications
  if (notification.testNotification) {
    console.log("[Google Play RTDN] Received test notification from Google Play Console.");
    return Response.json({ received: true });
  }

  const subNotif = notification.subscriptionNotification;
  if (!subNotif) {
    // Ignore non-subscription notifications (e.g. one-time products)
    return Response.json({ received: true });
  }

  const { purchaseToken, subscriptionId, notificationType } = subNotif;
  const admin = createServiceClient();

  try {
    // A shared Play topic can include purchases belonging to another environment.
    // Checkout/restore claims ownership; notifications only update known purchases.
    const { data: owned, error: ownershipError } = await admin
      .from("billing_subscriptions")
      .select("id")
      .eq("provider", "google_play")
      .eq("provider_environment", getGooglePlayEnvironment())
      .eq("provider_subscription_id", purchaseToken)
      .maybeSingle();
    if (ownershipError) throw ownershipError;
    if (!owned) return Response.json({ received: true, outcome: "unowned" });

    // Query current status from Google Play
    const verified = await verifyAndAcknowledgePlaySubscription({
      subscriptionId,
      purchaseToken,
      packageName: notification.packageName,
    });

    if (!verified.valid) {
      throw new Error("Google Play could not verify the notified purchase");
    }
    // RTDN says that state changed; the authenticated Publisher API response is
    // authoritative for access. Cancellation can remain active through period end.
    const newStatus = verified.active ? "active" : "canceled";

    const eventTimeMs = Number(notification.eventTimeMillis);
    if (!Number.isFinite(eventTimeMs) || eventTimeMs <= 0) {
      throw new Error("Google Play notification has an invalid event time");
    }
    const eventTime = new Date(eventTimeMs).toISOString();
    const { data: outcome, error } = await admin.rpc(
      "reconcile_google_play_event",
      {
        p_environment: getGooglePlayEnvironment(),
        p_event_id: body.message.messageId,
        p_event_type: `subscription_notification:${notificationType}`,
        p_purchase_token: purchaseToken,
        p_product_id: subscriptionId,
        p_status: newStatus,
        p_period_end: verified.periodEnd,
        p_event_created_at: eventTime,
        p_provider_updated_at: verified.providerUpdatedAt || new Date().toISOString(),
      }
    );
    if (error) throw error;

    return Response.json({ received: true, status: newStatus, outcome });
  } catch (err) {
    reportError(err, { route: "api/webhooks/google-play" });
    return new Response("Handler error", { status: 500 });
  }
}
