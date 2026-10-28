import { describe, expect, it } from "vitest";
import { customerDeliveryCharge, DEFAULT_BANK_HOLIDAYS, estimateDeliveryDate, type ZoneRates } from "./delivery";
import { findZone, parsePostcode } from "./postcode";
import { planSourcing, type SourcingContext, type SourcingLine, type SourcingSupplier } from "./sourcing";

const RATES: ZoneRates = {
  parcel: { chargeGross: 499, freeOverGross: 5000 },
  standard: { chargeGross: 999, freeOverGross: 15000 },
  heavy: { chargeGross: 2999, freeOverGross: 60000 },
};

describe("postcodes", () => {
  it("parses full and partial postcodes", () => {
    expect(parsePostcode("b15 2tt")).toEqual({ outward: "B15", inward: "2TT", area: "B", formatted: "B15 2TT", isFull: true });
    expect(parsePostcode("SW1A1AA")?.formatted).toBe("SW1A 1AA");
    expect(parsePostcode("WS10")).toMatchObject({ outward: "WS10", area: "WS", isFull: false });
    expect(parsePostcode("hello")).toBeNull();
    expect(parsePostcode("")).toBeNull();
  });

  it("matches districts before areas", () => {
    const zones = [
      { id: "core", postcodePrefixes: ["B", "CV", "DY", "WS", "WV"], active: true },
      { id: "special", postcodePrefixes: ["B99"], active: true },
    ];
    expect(findZone(parsePostcode("B15 2TT")!, zones)?.id).toBe("core");
    expect(findZone(parsePostcode("B99 1AA")!, zones)?.id).toBe("special");
    expect(findZone(parsePostcode("BA1 1AA")!, zones)).toBeNull();
  });
});

describe("delivery", () => {
  it("applies free delivery thresholds", () => {
    expect(customerDeliveryCharge(RATES, "standard", 14999)).toMatchObject({ chargeGross: 999, isFree: false });
    expect(customerDeliveryCharge(RATES, "standard", 15000)).toMatchObject({ chargeGross: 0, isFree: true });
  });

  const opts = { leadDays: 1, cutoffHour: 13, saturday: false, holidays: DEFAULT_BANK_HOLIDAYS };

  it("delivers next working day before the cut-off", () => {
    expect(estimateDeliveryDate(new Date("2026-10-27T10:00:00Z"), opts)).toBe("2026-10-28");
  });
  it("adds a day after the cut-off", () => {
    expect(estimateDeliveryDate(new Date("2026-10-27T14:00:00Z"), opts)).toBe("2026-10-29");
  });
  it("skips weekends", () => {
    expect(estimateDeliveryDate(new Date("2026-10-30T15:00:00Z"), opts)).toBe("2026-11-03");
    expect(estimateDeliveryDate(new Date("2026-10-31T09:00:00Z"), opts)).toBe("2026-11-03");
  });
  it("skips bank holidays", () => {
    expect(estimateDeliveryDate(new Date("2026-12-24T14:00:00Z"), opts)).toBe("2026-12-30");
  });
  it("uses UK time, including British Summer Time", () => {
    // 12:30 UTC is 13:30 in London during BST, which is after a 13:00 cut-off.
    expect(estimateDeliveryDate(new Date("2026-07-01T12:30:00Z"), opts)).toBe("2026-07-03");
  });
  it("supports Saturday delivery and extra zone days", () => {
    expect(estimateDeliveryDate(new Date("2026-10-29T14:00:00Z"), { ...opts, saturday: true })).toBe("2026-10-31");
    expect(estimateDeliveryDate(new Date("2026-10-27T10:00:00Z"), { ...opts, extraDays: 1 })).toBe("2026-10-29");
  });
});

describe("sourcing", () => {
  const local: SourcingSupplier = {
    id: "local",
    name: "Local merchant",
    active: true,
    servesAreas: ["B"],
    leadTimeDays: 1,
    cutoffHour: 13,
    deliversSaturday: false,
    deliveryCosts: { parcel: 450, standard: 900, heavy: 2500, freeOverNet: 50000 },
  };
  const national: SourcingSupplier = {
    id: "national",
    name: "National distributor",
    active: true,
    servesAreas: ["*"],
    leadTimeDays: 3,
    cutoffHour: 12,
    deliversSaturday: false,
    deliveryCosts: { parcel: 595, standard: 1095, heavy: 3495, freeOverNet: null },
  };
  const ctx = (area = "B"): SourcingContext => ({
    suppliers: [local, national],
    zone: { rates: RATES, extraLeadDays: 0 },
    postcodeArea: area,
    now: new Date("2026-10-27T10:00:00Z"),
    holidays: DEFAULT_BANK_HOLIDAYS,
    deliveryVatBps: 2000,
  });
  const offer = (supplierId: string, costNet: number, extra: Partial<SourcingLine["offers"][number]> = {}) => ({
    offerId: `${supplierId}-${costNet}`,
    supplierId,
    supplierSku: "X",
    costNet,
    stockStatus: "in_stock" as const,
    stockQty: null,
    leadTimeDays: null,
    verified: true,
    ...extra,
  });
  const boards: SourcingLine = {
    key: "boards",
    quantity: 10,
    unitGross: 1329,
    vatBps: 2000,
    deliveryClass: "heavy",
    offers: [offer("local", 820), offer("national", 880)],
  };
  const screws: SourcingLine = {
    key: "screws",
    quantity: 1,
    unitGross: 1279,
    vatBps: 2000,
    deliveryClass: "parcel",
    offers: [offer("local", 790), offer("national", 750)],
  };

  it("consolidates lines when that saves the customer a delivery charge", () => {
    const plan = planSourcing([boards, screws], ctx());
    expect(plan.strategy).toBe("consolidated");
    expect(plan.shipments).toHaveLength(1);
    expect(plan.shipments[0]).toMatchObject({ supplierId: "local", deliveryClass: "heavy", customerChargeGross: 2999 });
    expect(plan.customerDeliveryGross).toBe(2999);
    expect(plan.supplierCostNet).toBe(820 * 10 + 790);
  });

  it("splits deliveries when no single supplier has everything", () => {
    const tap: SourcingLine = { ...screws, key: "tap", offers: [offer("national", 2800)] };
    const onlyLocal: SourcingLine = { ...boards, offers: [offer("local", 820)] };
    const plan = planSourcing([onlyLocal, tap], ctx());
    expect(plan.shipments.map((s) => s.supplierId).sort()).toEqual(["local", "national"]);
    const dates = Object.fromEntries(plan.shipments.map((s) => [s.supplierId, s.estimatedDate]));
    expect(dates.local).toBe("2026-10-28");
    expect(dates.national).toBe("2026-10-30");
  });

  it("drops suppliers that don't serve the area or lack stock", () => {
    const outOfStock: SourcingLine = {
      ...boards,
      key: "oos",
      offers: [offer("local", 800, { stockStatus: "out_of_stock" }), offer("national", 900, { stockQty: 5 })],
    };
    const plan = planSourcing([outOfStock], ctx());
    expect(plan.unavailable.map((l) => l.key)).toEqual(["oos"]);
    expect(plan.strategy).toBe("none");

    const outside = planSourcing([{ ...boards, offers: [offer("local", 820)] }], ctx("CV"));
    expect(outside.unavailable).toHaveLength(1);
  });
});
