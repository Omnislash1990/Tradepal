import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { reorderAction, requestReturnAction } from "@/app/actions/account";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { DELIVERY_CLASS_LABEL, formatDeliveryDate } from "@/lib/domain/delivery";
import { formatGBP } from "@/lib/domain/money";
import { formatAddress } from "@/lib/format";
import { requireUser } from "@/lib/server/auth";
import { ORDER_STATUS_LABEL } from "@/lib/server/orders";

export async function generateMetadata({ params }: PageProps<"/account/orders/[number]">) {
  const { number } = await params;
  return { title: `Order ${number}` };
}

export default async function AccountOrderPage({ params }: PageProps<"/account/orders/[number]">) {
  const user = await requireUser("/account/orders");
  const { number } = await params;
  const order = await db.query.orders.findFirst({
    where: and(eq(orders.number, number), eq(orders.userId, user.id)),
    with: { lines: true, shipments: true },
  });
  if (!order) notFound();

  return (
    <div>
      <PageHeader title={order.number} description={`${ORDER_STATUS_LABEL[order.status]} · ${formatGBP(order.totalGross)}`} />
      <p className="mt-4 text-sm text-ink-600 whitespace-pre-line">{formatAddress(order.deliveryAddress, { multiline: true })}</p>
      <ul className="mt-6 divide-y divide-ink-100 rounded-2xl ring-1 ring-ink-200">
        {order.lines.map((l) => (
          <li key={l.id} className="flex justify-between px-4 py-3 text-sm">
            <span>
              {l.quantity} × {l.name}
            </span>
            <span>{formatGBP(l.unitGross * l.quantity)}</span>
          </li>
        ))}
      </ul>
      <ul className="mt-4 text-sm text-ink-600">
        {order.shipments.map((s) => (
          <li key={s.id}>
            {DELIVERY_CLASS_LABEL[s.deliveryClass]} estimated {formatDeliveryDate(s.estimatedDate)}
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href={`/track/${order.number}?t=${order.trackingToken}`} variant="secondary">
          Track
        </ButtonLink>
        <form action={reorderAction}>
          <input type="hidden" name="orderId" value={order.id} />
          <SubmitButton>Buy again</SubmitButton>
        </form>
      </div>
      {order.paymentStatus !== "unpaid" && (
        <form action={requestReturnAction} className="mt-8 max-w-md space-y-3 rounded-2xl bg-mist p-4">
          <h2 className="font-bold">Request a return</h2>
          <input type="hidden" name="orderId" value={order.id} />
          <Field label="Reason" name="reason">
            <Select id="reason" name="reason" defaultValue="changed_mind">
              <option value="changed_mind">Changed my mind</option>
              <option value="damaged">Damaged</option>
              <option value="wrong_item">Wrong item</option>
              <option value="faulty">Faulty</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Details" name="details">
            <Textarea id="details" name="details" />
          </Field>
          <SubmitButton variant="secondary">Submit return request</SubmitButton>
        </form>
      )}
    </div>
  );
}
