import type Stripe from "stripe";
import { getStripe, isBillingEnabled } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/admin";
import { reportError } from "@/lib/observability";

export const dynamic = "force-dynamic";

function resourceId(value: unknown): string {
  const id = typeof value === "string"
    ? value
    : value && typeof value === "object" && "id" in value ? value.id : null;
  if (typeof id !== "string" || !id) throw new Error("Missing Stripe resource ID");
  return id;
}

function periodEnd(subscription: Stripe.Subscription): string {
  const seconds = subscription.current_period_end;
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error("Missing or invalid Stripe subscription period end");
  }
  return new Date(seconds * 1000).toISOString();
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!isBillingEnabled() || !secret) {
    return new Response("billing disabled", { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, signature ?? "", secret);
  } catch {
    return new Response("invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        // Use only the signed resource ID from the event. Its API version is
        // independent of our SDK's version, so re-fetch the authoritative state.
        const stripe = getStripe();
        const session = await stripe.checkout.sessions.retrieve(resourceId(event.data.object));
        if (session.mode !== "subscription") break;
        const userId = session.client_reference_id;
        if (!userId) throw new Error("Subscription checkout has no owner reference");
        const cust = resourceId(session.customer);
        const sub = await stripe.subscriptions.retrieve(resourceId(session.subscription));
        if (resourceId(sub.customer) !== cust) {
          throw new Error("Checkout and subscription customers differ");
        }
        const end = periodEnd(sub);
        const admin = createServiceClient();
        // Checkout must have saved this customer mapping before opening Stripe.
        // An unmatched/mismatched owner is retryable, never a successful grant.
        const { data: profile, error: ownerError } = await admin
          .from("profiles")
          .select("user_id")
          .eq("stripe_customer_id", cust)
          .maybeSingle();
        if (ownerError) throw ownerError;
        if (profile?.user_id !== userId) {
          throw new Error("Stripe customer does not match checkout owner");
        }
        const { data, error } = await admin.from("profiles")
          .update({
            subscription_status: sub.status,
            subscription_current_period_end: end,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .eq("stripe_customer_id", cust)
          .select("user_id");
        if (error) throw error;
        if (data?.length !== 1) throw new Error("Stripe checkout owner was not updated");
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        // Canceled subscriptions remain retrievable. This also avoids applying
        // stale state embedded in a delayed update event.
        const sub = await getStripe().subscriptions.retrieve(resourceId(event.data.object));
        const cust = resourceId(sub.customer);
        const end = periodEnd(sub);
        const admin = createServiceClient();
        const { data, error } = await admin
          .from("profiles")
          .update({
            subscription_status: sub.status,
            subscription_current_period_end: end,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", cust)
          .select("user_id");
        if (error) throw error;
        if (data?.length !== 1) throw new Error("Stripe subscription owner was not updated");
        break;
      }
    }
  } catch (error) {
    reportError(error, { route: "stripe webhook", type: event.type });
    return new Response("handler error", { status: 500 });
  }

  return Response.json({ received: true });
}
