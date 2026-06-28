import type Stripe from "stripe";
import { getStripe, isBillingEnabled } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/admin";
import { reportError } from "@/lib/observability";

export const dynamic = "force-dynamic";

function customerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
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

  const admin = createServiceClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        const cust = customerId(session.customer);
        let status = "active";
        let periodEnd: string | null = null;
        if (session.subscription) {
          const sub = await getStripe().subscriptions.retrieve(
            session.subscription as string
          );
          status = sub.status;
          periodEnd = new Date(sub.current_period_end * 1000).toISOString();
        }
        if (userId) {
          await admin.from("profiles").upsert(
            {
              user_id: userId,
              stripe_customer_id: cust,
              subscription_status: status,
              subscription_current_period_end: periodEnd,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const cust = customerId(sub.customer);
        const status =
          event.type === "customer.subscription.deleted" ? "canceled" : sub.status;
        if (cust) {
          await admin
            .from("profiles")
            .update({
              subscription_status: status,
              subscription_current_period_end: new Date(
                sub.current_period_end * 1000
              ).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_customer_id", cust);
        }
        break;
      }
    }
  } catch (error) {
    reportError(error, { route: "stripe webhook", type: event.type });
    return new Response("handler error", { status: 500 });
  }

  return Response.json({ received: true });
}
