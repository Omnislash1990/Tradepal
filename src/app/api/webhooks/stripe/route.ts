import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { ensureDatabase } from "@/lib/db";
import { handleExpiredSession, handleFailedSession, handlePaidSession, stripe, stripeWebhookConfigured } from "@/lib/server/payments";

export async function POST(request: Request) {
  await ensureDatabase();
  if (!stripeWebhookConfigured()) {
    return NextResponse.json({ error: "Webhook is not configured" }, { status: 501 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
      await handlePaidSession(event.data.object, event.id);
      break;
    case "checkout.session.async_payment_succeeded":
      await handlePaidSession(event.data.object, event.id);
      break;
    case "checkout.session.async_payment_failed":
      await handleFailedSession(event.data.object, event.id);
      break;
    case "checkout.session.expired":
      await handleExpiredSession(event.data.object);
      break;
    default:
      break;
  }
  return NextResponse.json({ received: true });
}
