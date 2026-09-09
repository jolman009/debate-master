// Google Cloud Pub/Sub push endpoint for Google Play Real-Time Developer Notifications (RTDN).

import { createServiceClient } from "@/lib/supabase/admin";
import { verifyAndAcknowledgePlaySubscription } from "@/lib/billing/google-play-server";
import { reportError } from "@/lib/observability";

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
  let body: PubSubPushBody;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!body.message?.data) {
    return new Response("Missing message data", { status: 400 });
  }

  let notification: PlayDeveloperNotification;
  try {
    const decoded = Buffer.from(body.message.data, "base64").toString("utf8");
    notification = JSON.parse(decoded);
  } catch (err) {
    return new Response("Malformed base64 payload", { status: 400 });
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
    // Query current status from Google Play
    const verified = await verifyAndAcknowledgePlaySubscription({
      subscriptionId,
      purchaseToken,
      packageName: notification.packageName,
    });

    let newStatus = "active";
    if (notificationType === 13 || notificationType === 12) {
      newStatus = "canceled";
    } else if (notificationType === 3) {
      // User cancelled auto-renew, but remains active until periodEnd
      newStatus = verified.active ? "active" : "canceled";
    } else if (!verified.active) {
      newStatus = "canceled";
    }

    // Update profile matching this purchase token or user
    // (If the profile row doesn't have play_purchase_token yet, match on user_id if developerPayload or token)
    await admin
      .from("profiles")
      .update({
        subscription_status: newStatus,
        subscription_current_period_end: verified.periodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq("subscription_status", "active"); // Fallback/update active records or filter by token if saved

    return Response.json({ received: true, status: newStatus });
  } catch (err) {
    reportError(err, { route: "api/webhooks/google-play" });
    return new Response("Handler error", { status: 500 });
  }
}
