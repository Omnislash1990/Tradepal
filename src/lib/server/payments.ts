import "server-only";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, paymentEvents } from "@/lib/db/schema";
import { addOrderEvent, markOrderPaid } from "./orders";
import { appUrl } from "./notify";

/** Tags Tradepal's checkout sessions in the Stripe Dashboard. */
const CHECKOUT_INTEGRATION_ID = "tradepal_web_checkout_qmvhzkrt";

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function stripeWebhookConfigured(): boolean {
  return stripeConfigured() && !!process.env.STRIPE_WEBHOOK_SECRET;
}

let client: Stripe | null = null;
export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

export type CheckoutOrder = {
  id: string;
  number: string;
  email: string;
  deliveryGross: number;
  deliveryCount: number;
  lines: { name: string; quantity: number; unitGross: number }[];
};

export async function createStripeCheckout(order: CheckoutOrder): Promise<{ url: string; sessionId: string }> {
  const lineItems = order.lines.map((l) => ({
    quantity: l.quantity,
    price_data: { currency: "gbp", unit_amount: l.unitGross, product_data: { name: l.name.slice(0, 250) } },
  }));
  if (order.deliveryGross > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "gbp",
        unit_amount: order.deliveryGross,
        product_data: { name: order.deliveryCount > 1 ? `Delivery (${order.deliveryCount} deliveries)` : "Delivery" },
      },
    });
  }
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    integration_identifier: CHECKOUT_INTEGRATION_ID,
    customer_email: order.email,
    client_reference_id: order.id,
    metadata: { orderId: order.id, orderNumber: order.number },
    payment_intent_data: {
      description: `Tradepal order ${order.number}`,
      metadata: { orderId: order.id, orderNumber: order.number },
    },
    line_items: lineItems,
    success_url: appUrl(`/checkout/complete/${order.number}?session_id={CHECKOUT_SESSION_ID}`),
    cancel_url: appUrl(`/checkout?cancelled=${order.number}`),
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
  });
  await db.update(orders).set({ stripeSessionId: session.id }).where(eq(orders.id, order.id));
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { url: session.url, sessionId: session.id };
}

/** Fulfils a paid Checkout Session. Safe to call repeatedly for the same session. */
export async function handlePaidSession(session: Stripe.Checkout.Session, eventId: string): Promise<void> {
  if (session.payment_status !== "paid") return;
  const orderId = session.metadata?.orderId ?? session.client_reference_id;
  if (!orderId) return;
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
  const { updated } = await markOrderPaid(orderId, {
    provider: "stripe",
    reference: paymentIntentId,
    amountGross: session.amount_total ?? 0,
    eventId,
  });
  if (updated && paymentIntentId) await recordStripeFee(orderId, paymentIntentId);
}

/** Stores the actual processing fee so order contribution uses real figures. */
async function recordStripeFee(orderId: string, paymentIntentId: string): Promise<void> {
  try {
    const pi = await stripe().paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge.balance_transaction"] });
    const charge = pi.latest_charge;
    const txn = charge && typeof charge !== "string" ? charge.balance_transaction : null;
    if (txn && typeof txn !== "string") {
      await db.update(orders).set({ actualPaymentFee: txn.fee }).where(eq(orders.id, orderId));
    }
  } catch {
    // The fee can also be reconciled later from payouts; a failure here shouldn't block fulfilment.
  }
}

export async function handleFailedSession(session: Stripe.Checkout.Session, eventId: string): Promise<void> {
  const orderId = session.metadata?.orderId ?? session.client_reference_id;
  if (!orderId) return;
  await db.update(orders).set({ paymentStatus: "failed" }).where(eq(orders.id, orderId));
  await db.insert(paymentEvents).values({ providerEventId: eventId, orderId, provider: "stripe", type: "payment_failed" }).onConflictDoNothing();
  await addOrderEvent(orderId, "Payment failed. The customer can try again from their order page.", { type: "payment_failed", customerVisible: true });
}

export async function handleExpiredSession(session: Stripe.Checkout.Session): Promise<void> {
  const orderId = session.metadata?.orderId ?? session.client_reference_id;
  if (!orderId) return;
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (order && order.paymentStatus === "unpaid" && order.stripeSessionId === session.id) {
    await addOrderEvent(orderId, "Checkout expired before payment.", { type: "checkout_expired" });
  }
}

export async function refundPayment(
  paymentIntentId: string,
  amountGross: number,
  orderId: string,
): Promise<{ ok: true; id: string; status: string } | { ok: false; error: string }> {
  try {
    const refund = await stripe().refunds.create({ payment_intent: paymentIntentId, amount: amountGross, metadata: { orderId } });
    return { ok: true, id: refund.id, status: refund.status ?? "pending" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Stripe refund failed" };
  }
}

/** The Checkout Session's payment state, for the confirmation page (fulfilment happens in the webhook). */
export async function checkoutSessionStatus(sessionId: string): Promise<"paid" | "processing" | "unpaid" | "unknown"> {
  try {
    const session = await stripe().checkout.sessions.retrieve(sessionId);
    if (session.payment_status === "paid") return "paid";
    if (session.status === "complete") return "processing";
    return "unpaid";
  } catch {
    return "unknown";
  }
}
