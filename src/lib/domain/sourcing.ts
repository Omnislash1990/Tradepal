import {
  customerDeliveryCharge,
  estimateDeliveryDate,
  maxDeliveryClass,
  supplierDeliveryCost,
  type DeliveryClass,
  type SupplierDeliveryCosts,
  type ZoneRates,
} from "./delivery";
import { netFromGross } from "./vat";

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock" | "unknown";

export type SourcingOffer = {
  offerId: string;
  supplierId: string;
  supplierSku: string;
  costNet: number;
  stockStatus: StockStatus;
  stockQty: number | null;
  leadTimeDays: number | null;
  verified: boolean;
};

export type SourcingSupplier = {
  id: string;
  name: string;
  active: boolean;
  /** Postcode areas the supplier delivers to; "*" means nationwide. */
  servesAreas: string[];
  leadTimeDays: number;
  cutoffHour: number;
  deliversSaturday: boolean;
  deliveryCosts: SupplierDeliveryCosts;
};

export type SourcingLine = {
  key: string;
  quantity: number;
  unitGross: number;
  vatBps: number;
  deliveryClass: DeliveryClass;
  offers: SourcingOffer[];
};

export type AssignedLine = SourcingLine & { offer: SourcingOffer };

export type PlannedShipment = {
  supplierId: string;
  supplierName: string;
  lines: AssignedLine[];
  deliveryClass: DeliveryClass;
  goodsGross: number;
  goodsCostNet: number;
  customerChargeGross: number;
  isFreeDelivery: boolean;
  freeOverGross: number | null;
  supplierDeliveryCostNet: number;
  estimatedDate: string;
};

export type SourcingPlan = {
  shipments: PlannedShipment[];
  unavailable: SourcingLine[];
  goodsGross: number;
  customerDeliveryGross: number;
  supplierCostNet: number;
  supplierDeliveryNet: number;
  strategy: "cheapest" | "consolidated" | "none";
};

export type SourcingContext = {
  suppliers: SourcingSupplier[];
  zone: { rates: ZoneRates; extraLeadDays: number };
  postcodeArea: string;
  now: Date;
  holidays: string[];
  deliveryVatBps: number;
};

export function supplierServesArea(supplier: SourcingSupplier, area: string): boolean {
  return supplier.servesAreas.includes("*") || supplier.servesAreas.includes(area);
}

export function viableOffers(line: SourcingLine, ctx: SourcingContext): SourcingOffer[] {
  const byId = new Map(ctx.suppliers.map((s) => [s.id, s]));
  return line.offers
    .filter((offer) => {
      const supplier = byId.get(offer.supplierId);
      if (!supplier || !supplier.active || !supplierServesArea(supplier, ctx.postcodeArea)) return false;
      if (offer.stockStatus === "out_of_stock") return false;
      if (offer.stockQty != null && offer.stockQty < line.quantity) return false;
      return true;
    })
    .sort(
      (a, b) =>
        a.costNet - b.costNet ||
        Number(b.verified) - Number(a.verified) ||
        (a.leadTimeDays ?? 99) - (b.leadTimeDays ?? 99),
    );
}

function buildShipments(assigned: AssignedLine[], ctx: SourcingContext): PlannedShipment[] {
  const bySupplier = new Map<string, AssignedLine[]>();
  for (const line of assigned) {
    const list = bySupplier.get(line.offer.supplierId) ?? [];
    list.push(line);
    bySupplier.set(line.offer.supplierId, list);
  }
  const supplierById = new Map(ctx.suppliers.map((s) => [s.id, s]));
  const shipments: PlannedShipment[] = [];
  for (const [supplierId, lines] of bySupplier) {
    const supplier = supplierById.get(supplierId)!;
    const deliveryClass = maxDeliveryClass(lines.map((l) => l.deliveryClass));
    const goodsGross = lines.reduce((s, l) => s + l.unitGross * l.quantity, 0);
    const goodsCostNet = lines.reduce((s, l) => s + l.offer.costNet * l.quantity, 0);
    const charge = customerDeliveryCharge(ctx.zone.rates, deliveryClass, goodsGross);
    const leadDays = Math.max(...lines.map((l) => l.offer.leadTimeDays ?? supplier.leadTimeDays));
    shipments.push({
      supplierId,
      supplierName: supplier.name,
      lines,
      deliveryClass,
      goodsGross,
      goodsCostNet,
      customerChargeGross: charge.chargeGross,
      isFreeDelivery: charge.isFree,
      freeOverGross: charge.freeOverGross,
      supplierDeliveryCostNet: supplierDeliveryCost(supplier.deliveryCosts, deliveryClass, goodsCostNet),
      estimatedDate: estimateDeliveryDate(ctx.now, {
        leadDays,
        cutoffHour: supplier.cutoffHour,
        saturday: supplier.deliversSaturday,
        holidays: ctx.holidays,
        extraDays: ctx.zone.extraLeadDays,
      }),
    });
  }
  return shipments.sort((a, b) => a.estimatedDate.localeCompare(b.estimatedDate) || b.goodsGross - a.goodsGross);
}

function summarise(
  shipments: PlannedShipment[],
  unavailable: SourcingLine[],
  strategy: SourcingPlan["strategy"],
): SourcingPlan {
  return {
    shipments,
    unavailable,
    strategy,
    goodsGross: shipments.reduce((s, x) => s + x.goodsGross, 0),
    customerDeliveryGross: shipments.reduce((s, x) => s + x.customerChargeGross, 0),
    supplierCostNet: shipments.reduce((s, x) => s + x.goodsCostNet, 0),
    supplierDeliveryNet: shipments.reduce((s, x) => s + x.supplierDeliveryCostNet, 0),
  };
}

function contributionProxy(plan: SourcingPlan, deliveryVatBps: number): number {
  const goodsNet = plan.shipments
    .flatMap((s) => s.lines)
    .reduce((sum, l) => sum + netFromGross(l.unitGross * l.quantity, l.vatBps), 0);
  return (
    goodsNet +
    netFromGross(plan.customerDeliveryGross, deliveryVatBps) -
    plan.supplierCostNet -
    plan.supplierDeliveryNet
  );
}

/**
 * Chooses a supplier for every line. Two candidate plans are compared — cheapest offer per line, and
 * a greedy plan that consolidates lines onto as few suppliers as possible. The customer-friendlier
 * plan (lower delivery charges) wins; ties go to the higher contribution, then fewer deliveries.
 */
export function planSourcing(lines: SourcingLine[], ctx: SourcingContext): SourcingPlan {
  const candidates = lines.map((line) => ({ line, offers: viableOffers(line, ctx) }));
  const unavailable = candidates.filter((c) => c.offers.length === 0).map((c) => c.line);
  const sourceable = candidates.filter((c) => c.offers.length > 0);
  if (sourceable.length === 0) return summarise([], unavailable, "none");

  const cheapest = summarise(
    buildShipments(
      sourceable.map((c) => ({ ...c.line, offer: c.offers[0] })),
      ctx,
    ),
    unavailable,
    "cheapest",
  );

  const remaining = new Set(sourceable.map((c) => c.line.key));
  const assigned: AssignedLine[] = [];
  while (remaining.size > 0) {
    let bestSupplier: { id: string; covered: AssignedLine[]; cost: number } | null = null;
    for (const supplier of ctx.suppliers) {
      const covered: AssignedLine[] = [];
      let cost = 0;
      for (const c of sourceable) {
        if (!remaining.has(c.line.key)) continue;
        const offer = c.offers.find((o) => o.supplierId === supplier.id);
        if (!offer) continue;
        covered.push({ ...c.line, offer });
        cost += offer.costNet * c.line.quantity;
      }
      if (covered.length === 0) continue;
      if (
        !bestSupplier ||
        covered.length > bestSupplier.covered.length ||
        (covered.length === bestSupplier.covered.length && cost < bestSupplier.cost)
      ) {
        bestSupplier = { id: supplier.id, covered, cost };
      }
    }
    if (!bestSupplier) break;
    for (const line of bestSupplier.covered) {
      assigned.push(line);
      remaining.delete(line.key);
    }
  }
  const consolidated = summarise(buildShipments(assigned, ctx), unavailable, "consolidated");

  const pick = [cheapest, consolidated].sort(
    (a, b) =>
      a.customerDeliveryGross - b.customerDeliveryGross ||
      contributionProxy(b, ctx.deliveryVatBps) - contributionProxy(a, ctx.deliveryVatBps) ||
      a.shipments.length - b.shipments.length,
  );
  return pick[0];
}
