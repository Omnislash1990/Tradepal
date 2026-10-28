import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import {
  addSupplierInvoiceAction,
  cancelLineAction,
  refundOrderAction,
  sendPurchaseOrdersAction,
  substituteLineAction,
  updateShipmentAction,
} from "@/app/actions/admin";
import { PageHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { formatGBP } from "@/lib/domain/money";
import { formatAddress, formatDateTime } from "@/lib/format";
import { requireStaff } from "@/lib/server/auth";
import { loadCatalog } from "@/lib/server/catalog";
import { ORDER_STATUS_LABEL, SHIPMENT_STATUS_LABEL, orderEconomics } from "@/lib/server/orders";
import { AdminForm } from "../../admin-form";

export default async function AdminOrderPage({ params }: PageProps<"/admin/orders/[number]">) {
  await requireStaff("orders.view");
  const { number } = await params;
  const order = await db.query.orders.findFirst({
    where: eq(orders.number, number),
    with: { lines: true, shipments: true, events: true, purchaseOrders: true, refunds: true, supplierInvoices: true },
  });
  if (!order) notFound();
  const [econ, catalog] = await Promise.all([orderEconomics(order.id), loadCatalog()]);
  const alts = catalog.products.slice(0, 80);

  return (
    <div>
      <PageHeader title={order.number} description={`${ORDER_STATUS_LABEL[order.status]} · ${order.email}`} />
      <p className="mt-2 text-sm text-ink-600 whitespace-pre-line">{formatAddress(order.deliveryAddress, { multiline: true })}</p>
      {econ && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-white p-4 ring-1 ring-ink-200">
            <p className="text-xs font-semibold text-ink-500">Estimated contribution</p>
            <p className="text-2xl font-extrabold">{formatGBP(econ.estimated.contribution)}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 ring-1 ring-ink-200">
            <p className="text-xs font-semibold text-ink-500">Actual contribution {econ.actualComplete ? "" : "(partial)"}</p>
            <p className="text-2xl font-extrabold">{formatGBP(econ.actual.contribution)}</p>
          </div>
        </div>
      )}

      <h2 className="mt-8 font-bold">Lines</h2>
      <ul className="mt-2 divide-y divide-ink-100 rounded-2xl ring-1 ring-ink-200">
        {order.lines.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
            <span>
              {l.quantity} × {l.name} ({l.status})
            </span>
            <span>{formatGBP(l.unitGross * l.quantity)}</span>
            {l.status === "active" && (
              <div className="flex gap-2">
                <AdminForm action={cancelLineAction}>
                  <input type="hidden" name="lineId" value={l.id} />
                  <input type="hidden" name="reason" value="unavailable" />
                  <SubmitButton size="sm" variant="ghost">
                    Cancel
                  </SubmitButton>
                </AdminForm>
              </div>
            )}
          </li>
        ))}
      </ul>

      <h2 className="mt-8 font-bold">Deliveries</h2>
      {order.shipments.map((s) => (
        <AdminForm key={s.id} action={updateShipmentAction} className="mt-3 flex flex-wrap items-end gap-3 rounded-2xl p-4 ring-1 ring-ink-200">
          <input type="hidden" name="shipmentId" value={s.id} />
          <p className="w-full text-sm font-semibold">
            {SHIPMENT_STATUS_LABEL[s.status]} · supplier {s.supplierId}
          </p>
          <Field label="Status" name="status">
            <Select name="status" defaultValue={s.status}>
              {Object.entries(SHIPMENT_STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Carrier" name="carrier">
            <Input name="carrier" defaultValue={s.carrier ?? ""} />
          </Field>
          <Field label="Tracking" name="trackingRef">
            <Input name="trackingRef" defaultValue={s.trackingRef ?? ""} />
          </Field>
          <SubmitButton size="sm">Update</SubmitButton>
        </AdminForm>
      ))}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <AdminForm action={refundOrderAction} className="space-y-3 rounded-2xl p-4 ring-1 ring-ink-200">
          <h2 className="font-bold">Refund</h2>
          <input type="hidden" name="orderId" value={order.id} />
          <Field label="Amount £" name="amount">
            <Input name="amount" />
          </Field>
          <Field label="Reason" name="reason">
            <Input name="reason" required />
          </Field>
          <SubmitButton variant="danger">Issue refund</SubmitButton>
        </AdminForm>
        <AdminForm action={substituteLineAction} className="space-y-3 rounded-2xl p-4 ring-1 ring-ink-200">
          <h2 className="font-bold">Substitute a line</h2>
          <Field label="Line" name="lineId">
            <Select name="lineId">
              {order.lines.filter((l) => l.status === "active").map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Replacement product" name="productId">
            <Select name="productId">
              {alts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reason" name="reason">
            <Input name="reason" defaultValue="Supplier out of stock" />
          </Field>
          <SubmitButton variant="secondary">Substitute</SubmitButton>
        </AdminForm>
      </div>

      <form action={sendPurchaseOrdersAction} className="mt-6">
        <input type="hidden" name="orderId" value={order.id} />
        <SubmitButton variant="navy">Send / resend purchase orders</SubmitButton>
      </form>

      <AdminForm action={addSupplierInvoiceAction} className="mt-8 max-w-lg space-y-3 rounded-2xl p-4 ring-1 ring-ink-200">
        <h2 className="font-bold">Supplier invoice</h2>
        <input type="hidden" name="orderId" value={order.id} />
        <Field label="Supplier id" name="supplierId">
          <Input name="supplierId" defaultValue={order.shipments[0]?.supplierId ?? ""} />
        </Field>
        <Field label="Invoice number" name="invoiceNumber">
          <Input name="invoiceNumber" required />
        </Field>
        <Field label="Goods net £" name="goodsNet">
          <Input name="goodsNet" />
        </Field>
        <Field label="Delivery net £" name="deliveryNet">
          <Input name="deliveryNet" />
        </Field>
        <Field label="VAT £" name="vat">
          <Input name="vat" />
        </Field>
        <SubmitButton>Record invoice</SubmitButton>
      </AdminForm>

      <h2 className="mt-8 font-bold">Timeline</h2>
      <ol className="mt-3 space-y-2 text-sm">
        {order.events.map((e) => (
          <li key={e.id}>
            <span className="text-ink-500">{formatDateTime(e.createdAt)}</span> — {e.message}
          </li>
        ))}
      </ol>
    </div>
  );
}
