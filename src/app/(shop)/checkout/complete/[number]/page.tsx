import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { DELIVERY_CLASS_LABEL, formatDeliveryDate } from "@/lib/domain/delivery";
import { formatGBP } from "@/lib/domain/money";
import { formatAddress } from "@/lib/format";
import { getCurrentUser } from "@/lib/server/auth";
import { markOrderPaid } from "@/lib/server/orders";
import { checkoutSessionStatus, stripeConfigured } from "@/lib/server/payments";

export const metadata = { title: "Order confirmed" };

export default async function CompletePage({ params, searchParams }: PageProps<"/checkout/complete/[number]">) {
  const { number } = await params;
  const sp = await searchParams;
  const token = typeof sp.t === "string" ? sp.t : "";
  const sessionId = typeof sp.session_id === "string" ? sp.session_id : "";
  const user = await getCurrentUser();
  const order = await db.query.orders.findFirst({
    where: eq(orders.number, number),
    with: { lines: true, shipments: true },
  });
  if (!order) notFound();
  const allowed = order.trackingToken === token || (user && (user.id === order.userId || user.role !== "customer"));
  if (!allowed) notFound();

  if (order.paymentStatus === "unpaid" && sessionId && stripeConfigured()) {
    const status = await checkoutSessionStatus(sessionId);
    if (status === "paid") {
      await markOrderPaid(order.id, { provider: "stripe", reference: sessionId, amountGross: order.totalGross });
    }
  }

  const fresh = await db.query.orders.findFirst({ where: eq(orders.id, order.id), with: { lines: true, shipments: true } });
  const view = fresh ?? order;
  const paid = view.paymentStatus === "paid" || view.paymentStatus === "partially_refunded" || view.paymentStatus === "refunded";

  return (
    <Container className="py-10" width="narrow">
      <PageHeader
        eyebrow={paid ? "Thank you" : "Awaiting payment"}
        title={paid ? `Order ${view.number} confirmed` : `Order ${view.number} is waiting for payment`}
        description={paid ? `We've emailed ${view.email}. Track deliveries with the link below.` : "If you just paid, this page will update in a few seconds."}
      />
      <div className="mt-8 rounded-2xl bg-white p-5 shadow-card ring-1 ring-ink-200">
        <p className="font-semibold">{formatGBP(view.totalGross)} inc VAT</p>
        <p className="mt-2 text-sm text-ink-600 whitespace-pre-line">{formatAddress(view.deliveryAddress, { multiline: true })}</p>
        <ul className="mt-4 space-y-2 text-sm">
          {view.shipments.map((s) => (
            <li key={s.id}>
              {DELIVERY_CLASS_LABEL[s.deliveryClass]} estimated {formatDeliveryDate(s.estimatedDate)}
            </li>
          ))}
        </ul>
        <ul className="mt-4 divide-y divide-ink-100 text-sm">
          {view.lines.map((l) => (
            <li key={l.id} className="flex justify-between py-2">
              <span>
                {l.quantity} × {l.name}
              </span>
              <span>{formatGBP(l.unitGross * l.quantity)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href={`/track/${view.number}?t=${view.trackingToken}`}>Track order</ButtonLink>
        {user && (
          <ButtonLink href="/account/orders" variant="secondary">
            Order history
          </ButtonLink>
        )}
        <ButtonLink href="/products" variant="ghost">
          Continue shopping
        </ButtonLink>
      </div>
    </Container>
  );
}
