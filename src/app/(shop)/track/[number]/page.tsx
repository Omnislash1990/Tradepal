import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { DELIVERY_CLASS_LABEL, formatDeliveryDate } from "@/lib/domain/delivery";
import { formatGBP } from "@/lib/domain/money";
import { formatAddress, formatDateTime } from "@/lib/format";
import { getCurrentUser } from "@/lib/server/auth";
import { ORDER_STATUS_LABEL, SHIPMENT_STATUS_LABEL } from "@/lib/server/orders";

export const metadata = { title: "Track order" };

export default async function TrackPage({ params, searchParams }: PageProps<"/track/[number]">) {
  const { number } = await params;
  const sp = await searchParams;
  const token = typeof sp.t === "string" ? sp.t : "";
  const user = await getCurrentUser();
  const order = await db.query.orders.findFirst({
    where: eq(orders.number, number),
    with: { lines: true, shipments: true, events: true },
  });
  if (!order) notFound();
  const allowed = order.trackingToken === token || (user && (user.id === order.userId || user.role !== "customer"));
  if (!allowed) notFound();

  return (
    <Container className="py-8" width="narrow">
      <PageHeader
        eyebrow="Order tracking"
        title={order.number}
        description={`${ORDER_STATUS_LABEL[order.status]} · ${formatGBP(order.totalGross)}`}
      />
      <p className="mt-4 text-sm text-ink-600 whitespace-pre-line">{formatAddress(order.deliveryAddress, { multiline: true })}</p>
      <section className="mt-8 space-y-4">
        {order.shipments.map((s, i) => (
          <div key={s.id} className="rounded-2xl bg-white p-4 ring-1 ring-ink-200">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-bold">
                Delivery {i + 1} · {DELIVERY_CLASS_LABEL[s.deliveryClass]}
              </h2>
              <Badge>{SHIPMENT_STATUS_LABEL[s.status]}</Badge>
            </div>
            <p className="mt-1 text-sm text-ink-600">Estimated {formatDeliveryDate(s.estimatedDate)}</p>
            {s.trackingRef && (
              <p className="mt-1 text-sm">
                {s.carrier} {s.trackingRef}
              </p>
            )}
            <ul className="mt-3 text-sm">
              {order.lines
                .filter((l) => l.shipmentId === s.id)
                .map((l) => (
                  <li key={l.id}>
                    {l.quantity} × {l.name}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </section>
      <section className="mt-8">
        <h2 className="font-bold">Updates</h2>
        <ol className="mt-3 space-y-3 border-l-2 border-ink-200 pl-4">
          {order.events
            .filter((e) => e.customerVisible)
            .map((e) => (
              <li key={e.id}>
                <p className="text-sm font-medium">{e.message}</p>
                <p className="text-xs text-ink-500">{formatDateTime(e.createdAt)}</p>
              </li>
            ))}
        </ol>
      </section>
    </Container>
  );
}
