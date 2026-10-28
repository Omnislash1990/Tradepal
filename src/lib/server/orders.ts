import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  deliveryZones,
  orderEvents,
  orderLines,
  orders,
  paymentEvents,
  purchaseOrders,
  refunds,
  shipments,
  supplierInvoices,
  suppliers,
  type AddressSnapshot,
  type OrderStatus,
  type ShipmentStatus,
} from "@/lib/db/schema";
import { DELIVERY_CLASS_LABEL, formatDeliveryDate } from "@/lib/domain/delivery";
import { applyBps, formatGBP, VAT_STANDARD_BPS } from "@/lib/domain/money";
import { findZone, parsePostcode, type ParsedPostcode } from "@/lib/domain/postcode";
import { priceForCustomer, type CustomerPrice, type CustomerPricing } from "@/lib/domain/pricing";
import { calculateContribution, type ContributionBreakdown } from "@/lib/domain/profit";
import { planSourcing, type SourcingLine, type SourcingPlan, type SourcingSupplier } from "@/lib/domain/sourcing";
import { summariseVat, type VatSummary } from "@/lib/domain/vat";
import { newId, newReference, newToken } from "@/lib/ids";
import { loadCatalog, type CatalogProduct, type SupplierRow } from "./catalog";
import { appUrl, sendEmail } from "./notify";
import { getSettings } from "./settings";

export type ZoneRow = typeof deliveryZones.$inferSelect;

export function toSourcingSupplier(s: SupplierRow): SourcingSupplier {
  return {
    id: s.id,
    name: s.name,
    active: s.active,
    servesAreas: s.servesAreas,
    leadTimeDays: s.leadTimeDays,
    cutoffHour: s.cutoffHour,
    deliversSaturday: s.deliversSaturday,
    deliveryCosts: s.deliveryCosts,
  };
}

export type DraftLine = { product: CatalogProduct; quantity: number; price: CustomerPrice; lineGross: number };

export type OrderDraft = {
  postcode: ParsedPostcode;
  zone: ZoneRow;
  lines: DraftLine[];
  unavailable: DraftLine[];
  plan: SourcingPlan;
  goodsGross: number;
  deliveryGross: number;
  totalGross: number;
  savingsGross: number;
  vat: VatSummary;
  paymentFee: number;
  estimate: ContributionBreakdown;
};

export type DraftFailure = "invalid_postcode" | "outside_area" | "zone_inactive" | "empty";
export type DraftResult = { ok: true; draft: OrderDraft } | { ok: false; reason: DraftFailure; zone?: ZoneRow; postcode?: ParsedPostcode };

export async function resolveZone(rawPostcode: string | null | undefined): Promise<
  { ok: true; postcode: ParsedPostcode; zone: ZoneRow } | { ok: false; reason: Exclude<DraftFailure, "empty">; postcode?: ParsedPostcode; zone?: ZoneRow }
> {
  const postcode = parsePostcode(rawPostcode);
  if (!postcode) return { ok: false, reason: "invalid_postcode" };
  const zones = await db.select().from(deliveryZones);
  const zone = findZone(postcode, zones);
  if (!zone) return { ok: false, reason: "outside_area", postcode };
  if (!zone.active) return { ok: false, reason: "zone_inactive", postcode, zone };
  return { ok: true, postcode, zone };
}

/** Prices, sources and costs a basket for a delivery postcode — the "confirm costs" step. */
export async function buildOrderDraft(
  items: { productId: string; quantity: number }[],
  opts: { postcode: string | null | undefined; pricing: CustomerPricing | null; now: Date },
): Promise<DraftResult> {
  const where = await resolveZone(opts.postcode);
  if (!where.ok) return where;
  const [catalog, settings] = await Promise.all([loadCatalog(), getSettings()]);

  const lines: DraftLine[] = items
    .filter((i) => i.quantity > 0)
    .map((i) => ({ product: catalog.byId.get(i.productId), quantity: i.quantity }))
    .filter((i): i is { product: CatalogProduct; quantity: number } => !!i.product)
    .map(({ product, quantity }) => {
      const price = priceForCustomer(product, opts.pricing, opts.now);
      return { product, quantity, price, lineGross: price.unitGross * quantity };
    });
  if (lines.length === 0) return { ok: false, reason: "empty", postcode: where.postcode, zone: where.zone };

  const sourcingLines: SourcingLine[] = lines.map((l) => ({
    key: l.product.id,
    quantity: l.quantity,
    unitGross: l.price.unitGross,
    vatBps: l.product.vatBps,
    deliveryClass: l.product.deliveryClass,
    offers: l.product.offers
      .filter((o) => o.active)
      .map((o) => ({
        offerId: o.id,
        supplierId: o.supplierId,
        supplierSku: o.supplierSku,
        costNet: o.costNet,
        stockStatus: o.stockStatus,
        stockQty: o.stockQty,
        leadTimeDays: o.leadTimeDays,
        verified: o.verified,
      })),
  }));
  const plan = planSourcing(sourcingLines, {
    suppliers: catalog.suppliers.map(toSourcingSupplier),
    zone: { rates: where.zone.rates, extraLeadDays: where.zone.extraLeadDays },
    postcodeArea: where.postcode.area,
    now: opts.now,
    holidays: settings.delivery.bankHolidays,
    deliveryVatBps: VAT_STANDARD_BPS,
  });

  const unavailableKeys = new Set(plan.unavailable.map((l) => l.key));
  const sourceable = lines.filter((l) => !unavailableKeys.has(l.product.id));
  const unavailable = lines.filter((l) => unavailableKeys.has(l.product.id));
  const goodsGross = plan.goodsGross;
  const deliveryGross = plan.customerDeliveryGross;
  const totalGross = goodsGross + deliveryGross;
  const vat = summariseVat([
    ...sourceable.map((l) => ({ gross: l.lineGross, vatBps: l.product.vatBps })),
    { gross: deliveryGross, vatBps: VAT_STANDARD_BPS },
  ]);
  const paymentFee = totalGross > 0 ? applyBps(totalGross, settings.commerce.paymentFeeBps) + settings.commerce.paymentFeeFixed : 0;
  const estimate = calculateContribution({
    lines: sourceable.map((l) => ({ gross: l.lineGross, vatBps: l.product.vatBps })),
    deliveryGross,
    deliveryVatBps: VAT_STANDARD_BPS,
    supplierCostNet: plan.supplierCostNet,
    supplierDeliveryNet: plan.supplierDeliveryNet,
    paymentFeeBps: settings.commerce.paymentFeeBps,
    paymentFeeFixed: settings.commerce.paymentFeeFixed,
    otherCostsNet: 0,
    vatRegistered: settings.business.vatRegistered,
  });

  return {
    ok: true,
    draft: {
      postcode: where.postcode,
      zone: where.zone,
      lines: sourceable,
      unavailable,
      plan,
      goodsGross,
      deliveryGross,
      totalGross,
      savingsGross: sourceable.reduce((s, l) => s + l.price.savingGross * l.quantity, 0),
      vat,
      paymentFee,
      estimate,
    },
  };
}

export type OrderMeta = {
  userId: string | null;
  email: string;
  name: string;
  phone: string | null;
  companyName?: string | null;
  poReference?: string | null;
  isTrade: boolean;
  address: AddressSnapshot;
  provider: "stripe" | "demo";
  source: "web" | "assistant" | "quote";
  customerNotes?: string | null;
  createdAt?: Date;
};

export async function createOrder(draft: OrderDraft, meta: OrderMeta): Promise<{ id: string; number: string; trackingToken: string }> {
  const orderId = newId("ord");
  const number = newReference("TP");
  const trackingToken = newToken(18);
  const createdAt = meta.createdAt ?? new Date();
  const lineByProduct = new Map(draft.lines.map((l) => [l.product.id, l]));

  const shipmentRows = draft.plan.shipments.map((s) => ({
    id: newId("shp"),
    orderId,
    supplierId: s.supplierId,
    deliveryClass: s.deliveryClass,
    customerChargeGross: s.customerChargeGross,
    supplierDeliveryCostNet: s.supplierDeliveryCostNet,
    estimatedDate: s.estimatedDate,
    createdAt,
  }));
  const lineRows = draft.plan.shipments.flatMap((s, i) =>
    s.lines.map((assigned) => {
      const line = lineByProduct.get(assigned.key)!;
      return {
        orderId,
        shipmentId: shipmentRows[i].id,
        productId: line.product.id,
        supplierId: s.supplierId,
        sku: line.product.sku,
        name: line.product.name,
        quantity: line.quantity,
        unitGross: line.price.unitGross,
        regularUnitGross: line.price.regularGross,
        vatBps: line.product.vatBps,
        unitCostNet: assigned.offer.costNet,
        priceKind: line.price.kind,
      };
    }),
  );

  await db.batch([
    db.insert(orders).values({
      id: orderId,
      number,
      userId: meta.userId,
      email: meta.email,
      name: meta.name,
      phone: meta.phone,
      companyName: meta.companyName ?? null,
      poReference: meta.poReference ?? null,
      isTrade: meta.isTrade,
      deliveryAddress: meta.address,
      zoneId: draft.zone.id,
      goodsGross: draft.goodsGross,
      deliveryGross: draft.deliveryGross,
      totalGross: draft.totalGross,
      vatTotal: draft.vat.vat,
      savingsGross: draft.savingsGross,
      estSupplierCostNet: draft.plan.supplierCostNet,
      estSupplierDeliveryNet: draft.plan.supplierDeliveryNet,
      estPaymentFee: draft.paymentFee,
      paymentProvider: meta.provider,
      source: meta.source,
      trackingToken,
      customerNotes: meta.customerNotes ?? null,
      createdAt,
      updatedAt: createdAt,
    }),
    db.insert(shipments).values(shipmentRows),
    db.insert(orderLines).values(lineRows),
    db.insert(orderEvents).values({
      orderId,
      type: "placed",
      message: `Order placed: ${draft.plan.shipments.length} ${draft.plan.shipments.length === 1 ? "delivery" : "deliveries"}, total ${formatGBP(draft.totalGross)}.`,
      customerVisible: true,
      createdAt,
    }),
  ]);
  return { id: orderId, number, trackingToken };
}

export async function addOrderEvent(
  orderId: string,
  message: string,
  opts: { type?: string; actor?: string; customerVisible?: boolean } = {},
): Promise<void> {
  await db.insert(orderEvents).values({
    orderId,
    type: opts.type ?? "note",
    message,
    actor: opts.actor ?? "system",
    customerVisible: opts.customerVisible ?? false,
  });
}

export function orderUrl(order: { number: string; trackingToken: string }): string {
  return appUrl(`/track/${order.number}?t=${order.trackingToken}`);
}

/**
 * Marks an order paid exactly once, however many times the payment is reported (webhook retries,
 * the customer refreshing the confirmation page…), then starts fulfilment.
 */
export async function markOrderPaid(
  orderId: string,
  payment: { provider: "stripe" | "demo"; reference: string | null; amountGross: number; eventId?: string | null },
): Promise<{ updated: boolean }> {
  const now = new Date();
  const result = await db
    .update(orders)
    .set({
      status: "paid",
      paymentStatus: "paid",
      paidAt: now,
      stripePaymentIntentId: payment.provider === "stripe" ? payment.reference : null,
    })
    .where(and(eq(orders.id, orderId), eq(orders.paymentStatus, "unpaid")));
  if (result.rowsAffected === 0) return { updated: false };

  const order = (await db.query.orders.findFirst({ where: eq(orders.id, orderId), with: { lines: true, shipments: true } }))!;
  await db
    .insert(paymentEvents)
    .values({
      providerEventId: payment.eventId ?? null,
      orderId,
      provider: payment.provider,
      type: "payment_succeeded",
      amountGross: payment.amountGross,
      reference: payment.reference,
    })
    .onConflictDoNothing();
  await addOrderEvent(orderId, `Payment of ${formatGBP(payment.amountGross)} received.`, { type: "paid", customerVisible: true });
  if (payment.amountGross !== order.totalGross) {
    await addOrderEvent(
      orderId,
      `Payment amount ${formatGBP(payment.amountGross)} doesn't match the order total ${formatGBP(order.totalGross)} — check before fulfilling.`,
      { type: "payment_mismatch" },
    );
  }

  const settings = await getSettings();
  const deliveries = order.shipments
    .map((s, i) => {
      const items = order.lines.filter((l) => l.shipmentId === s.id).map((l) => `   ${l.quantity} × ${l.name}`);
      return `Delivery ${i + 1} of ${order.shipments.length} (${DELIVERY_CLASS_LABEL[s.deliveryClass].toLowerCase()}), estimated ${formatDeliveryDate(s.estimatedDate)}:\n${items.join("\n")}`;
    })
    .join("\n\n");
  await sendEmail({
    to: order.email,
    subject: `Order ${order.number} confirmed`,
    template: "order_confirmation",
    orderId,
    userId: order.userId,
    body: `Hi ${order.name.split(" ")[0]},\n\nThanks for your order with ${settings.business.tradingName}. We've received your payment of ${formatGBP(payment.amountGross)}.\n\n${deliveries}\n\nTrack your order: ${orderUrl(order)}\n\nYour items may arrive in separate deliveries from different suppliers. We'll email you when each one is on its way.`,
  });

  await runOrderAutomation(orderId);
  return { updated: true };
}

export type AutomationOutcome = { sent: number; held: string | null };

/** Sends purchase orders to each supplier, unless the order needs a person to check it first. */
export async function runOrderAutomation(orderId: string, opts: { force?: boolean; actor?: string } = {}): Promise<AutomationOutcome> {
  const settings = await getSettings();
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: { shipments: { with: { lines: true, purchaseOrders: true } } },
  });
  if (!order || order.paymentStatus === "unpaid" || order.status === "cancelled") return { sent: 0, held: "Order isn't paid" };

  if (!opts.force) {
    let held: string | null = null;
    if (!settings.commerce.autoSendPurchaseOrders) held = "Automatic purchase orders are switched off in settings.";
    else if (order.totalGross > settings.commerce.manualReviewOverGross)
      held = `Order total is over the ${formatGBP(settings.commerce.manualReviewOverGross)} review limit.`;
    if (held) {
      await addOrderEvent(orderId, `Held for review before purchase orders are sent: ${held}`, { type: "held" });
      return { sent: 0, held };
    }
  }

  const supplierRows = await db.select().from(suppliers).where(inArray(suppliers.id, order.shipments.map((s) => s.supplierId)));
  const supplierById = new Map(supplierRows.map((s) => [s.id, s]));
  let sent = 0;
  for (const shipment of order.shipments) {
    if (shipment.status === "cancelled") continue;
    if (shipment.purchaseOrders.some((p) => p.status !== "failed" && p.status !== "cancelled")) continue;
    const supplier = supplierById.get(shipment.supplierId)!;
    const activeLines = shipment.lines.filter((l) => l.status === "active");
    if (activeLines.length === 0) continue;
    if (order.paymentProvider === "demo" && !supplier.isSample) {
      await addOrderEvent(orderId, `Demo payment, so no purchase order was sent to ${supplier.name}.`, { type: "held" });
      continue;
    }
    const totalCostNet = activeLines.reduce((s, l) => s + l.unitCostNet * l.quantity, 0);
    const number = newReference("PO");
    const address = order.deliveryAddress;
    const payload = [
      `Purchase order ${number}`,
      `For customer order ${order.number}`,
      `Deliver to: ${[address.name, address.line1, address.line2, address.town, address.postcode].filter(Boolean).join(", ")}`,
      address.phone ? `Site contact: ${address.phone}` : null,
      address.instructions ? `Delivery notes: ${address.instructions}` : null,
      `Required by: ${formatDeliveryDate(shipment.estimatedDate)}`,
      "",
      ...activeLines.map((l) => `${l.quantity} × ${l.sku} — ${l.name} @ ${formatGBP(l.unitCostNet)} ex VAT`),
      "",
      `Goods total: ${formatGBP(totalCostNet)} ex VAT. Delivery agreed: ${formatGBP(shipment.supplierDeliveryCostNet)} ex VAT.`,
    ]
      .filter((x) => x !== null)
      .join("\n");

    const method = supplier.integration === "api" ? "api" : "email";
    const now = new Date();
    let poStatus: "sent" | "acknowledged" = "sent";
    let shipmentStatus: ShipmentStatus = "po_sent";
    let supplierRef: string | null = null;
    if (method === "api") {
      // Sample suppliers use a simulated API that acknowledges immediately.
      poStatus = "acknowledged";
      shipmentStatus = "confirmed";
      supplierRef = `${supplier.code}-${newReference("ACK", 5).slice(4)}`;
    } else if (supplier.email) {
      await sendEmail({
        to: supplier.email,
        subject: `Purchase order ${number} from ${settings.business.tradingName}`,
        template: "supplier_po",
        orderId,
        body: `${payload}\n\nPlease confirm receipt and dispatch date by replying to this email.`,
      });
    }
    await db.batch([
      db.insert(purchaseOrders).values({
        number,
        orderId,
        shipmentId: shipment.id,
        supplierId: supplier.id,
        method,
        status: poStatus,
        totalCostNet,
        deliveryCostNet: shipment.supplierDeliveryCostNet,
        supplierRef,
        payload,
        sentAt: now,
        acknowledgedAt: poStatus === "acknowledged" ? now : null,
      }),
      db.update(shipments).set({ status: shipmentStatus }).where(eq(shipments.id, shipment.id)),
      db.insert(orderEvents).values({
        orderId,
        type: "po_sent",
        actor: opts.actor ?? "system",
        message:
          method === "api"
            ? `Purchase order ${number} placed with ${supplier.name} via API and confirmed (${supplierRef}).`
            : `Purchase order ${number} emailed to ${supplier.name}.`,
      }),
    ]);
    sent++;
  }
  if (sent > 0) {
    await db.update(orders).set({ status: "processing" }).where(and(eq(orders.id, orderId), eq(orders.status, "paid")));
    await addOrderEvent(orderId, "We've ordered your items from our suppliers.", { type: "processing", customerVisible: true });
  }
  return { sent, held: null };
}

/** Works out the order status from its deliveries. */
export async function rollUpOrderStatus(orderId: string): Promise<OrderStatus | null> {
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId), with: { shipments: true } });
  if (!order || order.status === "cancelled" || order.status === "refunded" || order.paymentStatus === "unpaid") return null;
  const live = order.shipments.filter((s) => s.status !== "cancelled");
  if (live.length === 0) return null;
  const delivered = live.filter((s) => s.status === "delivered").length;
  const dispatched = live.filter((s) => s.status === "dispatched" || s.status === "delivered").length;
  let status: OrderStatus = order.status;
  if (delivered === live.length) status = "delivered";
  else if (dispatched === live.length) status = "dispatched";
  else if (dispatched > 0) status = "part_dispatched";
  else if (live.some((s) => s.status !== "pending")) status = "processing";
  if (status !== order.status) await db.update(orders).set({ status }).where(eq(orders.id, orderId));
  return status;
}

export async function updateShipmentStatus(
  shipmentId: string,
  update: { status: ShipmentStatus; carrier?: string | null; trackingRef?: string | null; actor: string },
): Promise<void> {
  const shipment = await db.query.shipments.findFirst({
    where: eq(shipments.id, shipmentId),
    with: { order: true, supplier: true, lines: true },
  });
  if (!shipment) throw new Error("Delivery not found");
  const now = new Date();
  await db
    .update(shipments)
    .set({
      status: update.status,
      carrier: update.carrier ?? shipment.carrier,
      trackingRef: update.trackingRef ?? shipment.trackingRef,
      dispatchedAt: update.status === "dispatched" ? now : shipment.dispatchedAt,
      deliveredAt: update.status === "delivered" ? now : shipment.deliveredAt,
    })
    .where(eq(shipments.id, shipmentId));
  const items = shipment.lines.filter((l) => l.status === "active").map((l) => `${l.quantity} × ${l.name}`);
  const order = shipment.order;
  const which = `Your ${DELIVERY_CLASS_LABEL[shipment.deliveryClass].toLowerCase()} (${items.length} ${items.length === 1 ? "item" : "items"})`;
  const label: Partial<Record<ShipmentStatus, string>> = {
    confirmed: `${shipment.supplier.name} confirmed the order.`,
    dispatched: `${which} is on its way${update.trackingRef ? ` (tracking ${update.trackingRef})` : ""}.`,
    delivered: `${which} was delivered.`,
    failed: `${which} couldn't be completed — we'll be in touch.`,
    cancelled: `${which} was cancelled.`,
  };
  await addOrderEvent(order.id, label[update.status] ?? `Delivery status changed to ${update.status}.`, {
    type: `shipment_${update.status}`,
    actor: update.actor,
    customerVisible: update.status !== "confirmed",
  });
  if (update.status === "dispatched" || update.status === "delivered") {
    await sendEmail({
      to: order.email,
      subject: update.status === "dispatched" ? `Part of order ${order.number} is on its way` : `Delivered: part of order ${order.number}`,
      template: update.status === "dispatched" ? "order_dispatched" : "order_delivered",
      orderId: order.id,
      userId: order.userId,
      body: `Hi ${order.name.split(" ")[0]},\n\n${update.status === "dispatched" ? "These items are on their way" : "These items have been delivered"}:\n${items.map((i) => ` • ${i}`).join("\n")}\n${update.trackingRef ? `\nCarrier reference: ${update.carrier ?? ""} ${update.trackingRef}\n` : ""}\nTrack everything on your order: ${orderUrl(order)}`,
    });
  }
  await rollUpOrderStatus(order.id);
}

export type RefundRequest = {
  amountGross: number;
  reason: string;
  lines?: { lineId: string; quantity: number }[];
  actor: string;
  notifyCustomer?: boolean;
};

export async function issueRefund(orderId: string, req: RefundRequest): Promise<{ ok: true } | { ok: false; error: string }> {
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId), with: { lines: true } });
  if (!order) return { ok: false, error: "Order not found" };
  if (order.paymentStatus === "unpaid" || order.paymentStatus === "failed") return { ok: false, error: "This order hasn't been paid." };
  const refundable = order.totalGross - order.refundedGross;
  if (req.amountGross <= 0 || req.amountGross > refundable) {
    return { ok: false, error: `Refund must be between £0.01 and ${formatGBP(refundable)}.` };
  }

  let providerRef: string | null = null;
  let status: "succeeded" | "pending" = "succeeded";
  if (order.paymentProvider === "stripe" && order.stripePaymentIntentId) {
    const { refundPayment } = await import("./payments");
    const result = await refundPayment(order.stripePaymentIntentId, req.amountGross, orderId);
    if (!result.ok) return { ok: false, error: result.error };
    providerRef = result.id;
    status = result.status === "succeeded" ? "succeeded" : "pending";
  }

  const refundedGross = order.refundedGross + req.amountGross;
  const full = refundedGross >= order.totalGross;
  const lineUpdates = (req.lines ?? []).map((l) => {
    const line = order.lines.find((x) => x.id === l.lineId);
    const qty = Math.min(line?.quantity ?? 0, (line?.refundedQty ?? 0) + l.quantity);
    return db.update(orderLines).set({ refundedQty: qty }).where(eq(orderLines.id, l.lineId));
  });
  await db.batch([
    db.insert(refunds).values({
      orderId,
      amountGross: req.amountGross,
      reason: req.reason,
      lines: req.lines ?? [],
      provider: order.paymentProvider === "stripe" ? "stripe" : "demo",
      providerRef,
      status,
      createdBy: req.actor,
    }),
    db
      .update(orders)
      .set({
        refundedGross,
        paymentStatus: full ? "refunded" : "partially_refunded",
        status: full ? "refunded" : order.status,
      })
      .where(eq(orders.id, orderId)),
    db.insert(orderEvents).values({
      orderId,
      type: "refund",
      actor: req.actor,
      customerVisible: true,
      message: `Refund of ${formatGBP(req.amountGross)} issued: ${req.reason}.`,
    }),
    ...lineUpdates,
  ]);
  if (req.notifyCustomer !== false) {
    await sendEmail({
      to: order.email,
      subject: `Refund for order ${order.number}`,
      template: "refund_issued",
      orderId,
      userId: order.userId,
      body: `Hi ${order.name.split(" ")[0]},\n\nWe've refunded ${formatGBP(req.amountGross)} to your original payment method (${req.reason}). Refunds usually reach your account within 5–10 working days.\n\nOrder details: ${orderUrl(order)}`,
    });
  }
  return { ok: true };
}

/** Cancels a line that can't be supplied and refunds it. */
export async function cancelOrderLine(lineId: string, opts: { reason: string; actor: string }) {
  const line = await db.query.orderLines.findFirst({ where: eq(orderLines.id, lineId), with: { order: true } });
  if (!line) return { ok: false as const, error: "Line not found" };
  if (line.status !== "active") return { ok: false as const, error: "This line has already been changed." };
  await db.update(orderLines).set({ status: "cancelled" }).where(eq(orderLines.id, lineId));
  const refundQty = line.quantity - line.refundedQty;
  const amount = line.unitGross * refundQty;
  if (line.order.paymentStatus !== "unpaid" && amount > 0) {
    const res = await issueRefund(line.orderId, {
      amountGross: amount,
      reason: `${line.name} cancelled — ${opts.reason}`,
      lines: [{ lineId, quantity: refundQty }],
      actor: opts.actor,
    });
    if (!res.ok) return res;
  } else {
    await addOrderEvent(line.orderId, `${line.name} removed from the order: ${opts.reason}.`, { actor: opts.actor, customerVisible: true });
  }
  return { ok: true as const };
}

/**
 * Replaces an unavailable item with an alternative. The customer never pays more than they agreed;
 * if the substitute is cheaper the difference is refunded.
 */
export async function substituteOrderLine(lineId: string, opts: { productId: string; reason: string; actor: string }) {
  const line = await db.query.orderLines.findFirst({ where: eq(orderLines.id, lineId), with: { order: true, shipment: true } });
  if (!line) return { ok: false as const, error: "Line not found" };
  if (line.status !== "active") return { ok: false as const, error: "This line has already been changed." };
  const catalog = await loadCatalog();
  const product = catalog.byId.get(opts.productId);
  if (!product) return { ok: false as const, error: "Substitute product not found" };
  const offer =
    product.offers.find((o) => o.active && o.supplierId === line.supplierId && o.stockStatus !== "out_of_stock") ??
    product.offers.filter((o) => o.active && o.stockStatus !== "out_of_stock").sort((a, b) => a.costNet - b.costNet)[0];
  if (!offer) return { ok: false as const, error: "No supplier has that product in stock" };
  const newUnit = Math.min(line.unitGross, product.retailPriceGross);
  const difference = (line.unitGross - newUnit) * line.quantity;

  await db.batch([
    db.update(orderLines).set({ status: "substituted" }).where(eq(orderLines.id, lineId)),
    db.insert(orderLines).values({
      orderId: line.orderId,
      shipmentId: offer.supplierId === line.supplierId ? line.shipmentId : null,
      productId: product.id,
      supplierId: offer.supplierId,
      sku: product.sku,
      name: product.name,
      quantity: line.quantity,
      unitGross: newUnit,
      regularUnitGross: product.retailPriceGross,
      vatBps: product.vatBps,
      unitCostNet: offer.costNet,
      priceKind: line.priceKind,
      substitutedFrom: line.sku,
    }),
    db.insert(orderEvents).values({
      orderId: line.orderId,
      type: "substitution",
      actor: opts.actor,
      customerVisible: true,
      message: `${line.name} replaced with ${product.name} (${opts.reason}).${difference > 0 ? ` ${formatGBP(difference)} refunded for the price difference.` : " Same price as you paid."}`,
    }),
  ]);
  if (difference > 0 && line.order.paymentStatus !== "unpaid") {
    await issueRefund(line.orderId, { amountGross: difference, reason: `price difference on substitute for ${line.name}`, actor: opts.actor, notifyCustomer: false });
  }
  await sendEmail({
    to: line.order.email,
    subject: `A change to order ${line.order.number}`,
    template: "substitution",
    orderId: line.orderId,
    userId: line.order.userId,
    body: `Hi ${line.order.name.split(" ")[0]},\n\n${line.name} isn't available, so we've replaced it with ${product.name} (${opts.reason}).${difference > 0 ? ` As it's cheaper, we've refunded the ${formatGBP(difference)} difference.` : ""}\n\nIf you'd rather cancel this item for a full refund, just reply to this email.\n\n${orderUrl(line.order)}`,
  });
  return { ok: true as const };
}

export async function recordSupplierInvoice(input: {
  supplierId: string;
  orderId: string | null;
  purchaseOrderId: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  goodsNet: number;
  deliveryNet: number;
  vat: number;
  notes?: string | null;
  actor: string;
}) {
  let status: "received" | "matched" = "received";
  if (input.purchaseOrderId) {
    const po = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, input.purchaseOrderId) });
    if (po && po.totalCostNet === input.goodsNet && po.deliveryCostNet === input.deliveryNet) status = "matched";
  }
  const { actor: _actor, ...invoice } = input;
  await db.insert(supplierInvoices).values({ ...invoice, notes: input.notes ?? null, status });
  if (input.orderId) {
    await addOrderEvent(
      input.orderId,
      `Supplier invoice ${input.invoiceNumber} recorded: ${formatGBP(input.goodsNet + input.deliveryNet)} ex VAT (${status === "matched" ? "matches the purchase order" : "check against the purchase order"}).`,
      { type: "supplier_invoice", actor: input.actor },
    );
  }
  return status;
}

export type OrderEconomics = {
  estimated: ContributionBreakdown;
  actual: ContributionBreakdown;
  /** True once every purchase order has a supplier invoice. */
  actualComplete: boolean;
};

export async function orderEconomics(orderId: string): Promise<OrderEconomics | null> {
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: { lines: true, purchaseOrders: true, supplierInvoices: true },
  });
  if (!order) return null;
  const settings = await getSettings();
  const base = {
    // Substitutes weren't charged separately — the customer paid for the line they replaced.
    lines: order.lines.filter((l) => !l.substitutedFrom).map((l) => ({ gross: l.unitGross * l.quantity, vatBps: l.vatBps })),
    deliveryGross: order.deliveryGross,
    deliveryVatBps: VAT_STANDARD_BPS,
    otherCostsNet: 0,
    vatRegistered: settings.business.vatRegistered,
  };
  const estimated = calculateContribution({
    ...base,
    paymentFeeBps: settings.commerce.paymentFeeBps,
    paymentFeeFixed: settings.commerce.paymentFeeFixed,
    supplierCostNet: order.estSupplierCostNet,
    supplierDeliveryNet: order.estSupplierDeliveryNet,
  });
  if (order.paymentStatus === "unpaid" || order.paymentStatus === "failed") {
    const nothing = calculateContribution({ ...base, lines: [], deliveryGross: 0, supplierCostNet: 0, supplierDeliveryNet: 0, paymentFeeBps: 0, paymentFeeFixed: 0 });
    return { estimated, actual: nothing, actualComplete: false };
  }

  const livePos = order.purchaseOrders.filter((p) => p.status !== "cancelled" && p.status !== "failed");
  const invoicedPoIds = new Set(order.supplierInvoices.map((i) => i.purchaseOrderId).filter(Boolean));
  const uninvoiced = livePos.filter((p) => !invoicedPoIds.has(p.id));
  const invoicedGoods = order.supplierInvoices.reduce((s, i) => s + i.goodsNet, 0);
  const invoicedDelivery = order.supplierInvoices.reduce((s, i) => s + i.deliveryNet, 0);
  const supplierCostNet = livePos.length
    ? invoicedGoods + uninvoiced.reduce((s, p) => s + p.totalCostNet, 0)
    : order.lines.filter((l) => l.status === "active").reduce((s, l) => s + l.unitCostNet * l.quantity, 0);
  const supplierDeliveryNet = livePos.length
    ? invoicedDelivery + uninvoiced.reduce((s, p) => s + p.deliveryCostNet, 0)
    : order.estSupplierDeliveryNet;
  const actual = calculateContribution({
    ...base,
    supplierCostNet,
    supplierDeliveryNet,
    refundsGross: order.refundedGross,
    paymentFeeBps: order.actualPaymentFee != null ? 0 : settings.commerce.paymentFeeBps,
    paymentFeeFixed: order.actualPaymentFee ?? settings.commerce.paymentFeeFixed,
  });
  return { estimated, actual, actualComplete: livePos.length > 0 && uninvoiced.length === 0 };
}

export async function cancelUnpaidOrder(orderId: string, actor: string): Promise<boolean> {
  const res = await db
    .update(orders)
    .set({ status: "cancelled" })
    .where(and(eq(orders.id, orderId), eq(orders.paymentStatus, "unpaid")));
  if (res.rowsAffected > 0) {
    await db.update(shipments).set({ status: "cancelled" }).where(eq(shipments.orderId, orderId));
    await addOrderEvent(orderId, "Unpaid order cancelled.", { actor, customerVisible: true, type: "cancelled" });
  }
  return res.rowsAffected > 0;
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  paid: "Paid",
  processing: "Being prepared",
  part_dispatched: "Partly dispatched",
  dispatched: "Dispatched",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export const SHIPMENT_STATUS_LABEL: Record<ShipmentStatus, string> = {
  pending: "Waiting to order",
  po_sent: "Ordered from supplier",
  confirmed: "Confirmed by supplier",
  dispatched: "On its way",
  delivered: "Delivered",
  failed: "Delivery problem",
  cancelled: "Cancelled",
};
