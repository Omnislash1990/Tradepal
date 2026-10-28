import { describe, expect, it } from "vitest";
import { formatBps, formatGBP, parsePoundsInput } from "./money";
import {
  calculateRetailPrice,
  pickPricingRule,
  priceForCustomer,
  roundPrice,
  tradePrice,
  type PricingRule,
} from "./pricing";
import { netFromGross, summariseVat, vatInGross } from "./vat";

const rule = (over: Partial<PricingRule>): PricingRule => ({
  id: "r",
  name: "Rule",
  scope: "global",
  scopeId: null,
  markupBps: 3500,
  minMarginBps: 1500,
  rounding: "end9",
  priority: 0,
  active: true,
  ...over,
});

describe("money", () => {
  it("formats pence as pounds", () => {
    expect(formatGBP(123456)).toBe("£1,234.56");
    expect(formatGBP(-500)).toBe("-£5.00");
  });
  it("parses typed pound amounts", () => {
    expect(parsePoundsInput("£1,234.50")).toBe(123450);
    expect(parsePoundsInput("")).toBeNull();
    expect(parsePoundsInput("abc")).toBeNull();
  });
  it("formats basis points", () => {
    expect(formatBps(2000)).toBe("20%");
    expect(formatBps(1250)).toBe("12.5%");
  });
});

describe("VAT", () => {
  it("splits gross prices", () => {
    expect(netFromGross(12000, 2000)).toBe(10000);
    expect(vatInGross(15000, 2000)).toBe(2500);
  });
  it("summarises by rate from gross totals", () => {
    const s = summariseVat([
      { gross: 1200, vatBps: 2000 },
      { gross: 600, vatBps: 2000 },
      { gross: 500, vatBps: 0 },
    ]);
    expect(s).toMatchObject({ gross: 2300, net: 2000, vat: 300 });
    expect(s.byRate).toHaveLength(2);
  });
});

describe("pricing rules", () => {
  it("rounds to charm prices", () => {
    expect(roundPrice(1234, "end9")).toBe(1239);
    expect(roundPrice(1239, "end9")).toBe(1239);
    expect(roundPrice(1240, "end9")).toBe(1249);
    expect(roundPrice(1234, "end49or99")).toBe(1249);
    expect(roundPrice(1250, "end49or99")).toBe(1299);
    expect(roundPrice(1234, "none")).toBe(1234);
  });

  it("prefers the most specific active rule", () => {
    const rules = [
      rule({ id: "global" }),
      rule({ id: "cat", scope: "category", scopeId: "c1" }),
      rule({ id: "cat-off", scope: "category", scopeId: "c2", active: false }),
      rule({ id: "sup", scope: "supplier", scopeId: "s1", priority: 5 }),
    ];
    expect(pickPricingRule(rules, { categoryId: "c1", supplierId: "s1" })?.id).toBe("cat");
    expect(pickPricingRule(rules, { categoryId: "c2", supplierId: "s1" })?.id).toBe("sup");
    expect(pickPricingRule(rules, { categoryId: "c2", supplierId: null })?.id).toBe("global");
  });

  it("applies markup, VAT and rounding", () => {
    const price = calculateRetailPrice({ costNet: 820, vatBps: 2000, rule: rule({}) });
    expect(price.grossPrice).toBe(1329);
    expect(price.netPrice).toBe(1108);
    expect(price.marginBps).toBeGreaterThanOrEqual(1500);
  });

  it("raises the price until the minimum margin is met", () => {
    const price = calculateRetailPrice({
      costNet: 1000,
      vatBps: 2000,
      rule: rule({ markupBps: 1000, minMarginBps: 2000, rounding: "none" }),
    });
    expect(price.grossPrice).toBe(1500);
    expect(price.marginBps).toBe(2000);
  });

  it("respects manual overrides", () => {
    const price = calculateRetailPrice({ costNet: 820, vatBps: 2000, rule: rule({}), overrideGross: 1999 });
    expect(price).toMatchObject({ grossPrice: 1999, netPrice: 1666, source: "override" });
  });

  it("caps trade discounts at the margin floor", () => {
    expect(tradePrice({ gross: 1200, discountBps: 1000, costNet: 500, vatBps: 2000, floorMarginBps: 1000 })).toEqual({
      gross: 1080,
      capped: false,
    });
    expect(tradePrice({ gross: 1200, discountBps: 1000, costNet: 900, vatBps: 2000, floorMarginBps: 1000 })).toEqual({
      gross: 1200,
      capped: true,
    });
  });

  it("gives customers the best of regular, promotional and trade prices", () => {
    const now = new Date("2026-10-27T12:00:00Z");
    const product = {
      retailPriceGross: 1000,
      vatBps: 2000,
      refCostNet: 500,
      promoBps: 1500,
      promoEndsAt: new Date("2026-11-30T00:00:00Z"),
    };
    const trade = { tradeDiscountBps: 1000, tradeFloorMarginBps: 1000 };
    expect(priceForCustomer(product, null, now)).toMatchObject({ unitGross: 850, kind: "promo" });
    expect(priceForCustomer(product, trade, now)).toMatchObject({ unitGross: 850, kind: "promo" });
    const expired = { ...product, promoEndsAt: new Date("2026-10-01T00:00:00Z") };
    expect(priceForCustomer(expired, trade, now)).toMatchObject({ unitGross: 900, kind: "trade", savingGross: 100 });
    expect(priceForCustomer(expired, null, now)).toMatchObject({ unitGross: 1000, kind: "regular" });
  });
});
