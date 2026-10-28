import { grossFromNet, netFromGross } from "./vat";

export type Rounding = "none" | "end9" | "end49or99";

export const ROUNDING_LABELS: Record<Rounding, string> = {
  none: "Nearest penny",
  end9: "Round up to …9p",
  end49or99: "Round up to .49 / .99",
};

export type PricingRuleScope = "global" | "category" | "supplier";

export type PricingRule = {
  id: string;
  name: string;
  scope: PricingRuleScope;
  scopeId: string | null;
  markupBps: number;
  minMarginBps: number;
  rounding: Rounding;
  priority: number;
  active: boolean;
};

export const FALLBACK_RULE: PricingRule = {
  id: "fallback",
  name: "Fallback (no rule configured)",
  scope: "global",
  scopeId: null,
  markupBps: 3500,
  minMarginBps: 1500,
  rounding: "end9",
  priority: -1,
  active: true,
};

const SCOPE_SPECIFICITY: Record<PricingRuleScope, number> = { category: 3, supplier: 2, global: 1 };

/** Most specific active rule wins (category, then supplier, then global); ties go to higher priority. */
export function pickPricingRule(
  rules: PricingRule[],
  ctx: { categoryId: string; supplierId: string | null },
): PricingRule | null {
  const candidates = rules.filter(
    (r) =>
      r.active &&
      (r.scope === "global" ||
        (r.scope === "category" && r.scopeId === ctx.categoryId) ||
        (r.scope === "supplier" && ctx.supplierId !== null && r.scopeId === ctx.supplierId)),
  );
  candidates.sort(
    (a, b) => SCOPE_SPECIFICITY[b.scope] - SCOPE_SPECIFICITY[a.scope] || b.priority - a.priority,
  );
  return candidates[0] ?? null;
}

/** Rounds a gross price up to the next price point for the chosen strategy. */
export function roundPrice(pence: number, rounding: Rounding): number {
  const p = Math.ceil(pence);
  switch (rounding) {
    case "none":
      return p;
    case "end9": {
      const r = p % 10;
      return r === 9 ? p : p + (9 - r);
    }
    case "end49or99": {
      const r = p % 100;
      if (r === 49 || r === 99) return p;
      return r < 49 ? p - r + 49 : p - r + 99;
    }
  }
}

export function marginBps(netPrice: number, costNet: number): number {
  if (netPrice <= 0) return 0;
  return Math.round(((netPrice - costNet) * 10000) / netPrice);
}

export type PriceCalculation = {
  grossPrice: number;
  netPrice: number;
  costNet: number;
  marginBps: number;
  ruleId: string | null;
  source: "override" | "rule";
};

export function calculateRetailPrice(input: {
  costNet: number;
  vatBps: number;
  rule: PricingRule | null;
  overrideGross?: number | null;
}): PriceCalculation {
  const { costNet, vatBps } = input;
  if (input.overrideGross != null && input.overrideGross > 0) {
    const netPrice = netFromGross(input.overrideGross, vatBps);
    return {
      grossPrice: input.overrideGross,
      netPrice,
      costNet,
      marginBps: marginBps(netPrice, costNet),
      ruleId: null,
      source: "override",
    };
  }
  const rule = input.rule ?? FALLBACK_RULE;
  const targetNet = Math.ceil((costNet * (10000 + rule.markupBps)) / 10000);
  let gross = roundPrice(grossFromNet(targetNet, vatBps), rule.rounding);
  for (let guard = 0; guard < 2000; guard++) {
    if (marginBps(netFromGross(gross, vatBps), costNet) >= rule.minMarginBps) break;
    gross = roundPrice(gross + 1, rule.rounding);
  }
  const netPrice = netFromGross(gross, vatBps);
  return {
    grossPrice: gross,
    netPrice,
    costNet,
    marginBps: marginBps(netPrice, costNet),
    ruleId: rule.id === FALLBACK_RULE.id ? null : rule.id,
    source: "rule",
  };
}

export type PricedProductInput = {
  retailPriceGross: number;
  vatBps: number;
  refCostNet: number | null;
  promoBps: number | null;
  promoEndsAt: Date | null;
};

export type CustomerPricing = {
  tradeDiscountBps: number;
  /** Trade discounts never take the net margin below this floor. */
  tradeFloorMarginBps: number;
};

export type CustomerPrice = {
  unitGross: number;
  unitNet: number;
  regularGross: number;
  kind: "regular" | "promo" | "trade";
  savingGross: number;
};

export function isPromoActive(p: Pick<PricedProductInput, "promoBps" | "promoEndsAt">, now: Date): boolean {
  if (!p.promoBps || p.promoBps <= 0) return false;
  return !p.promoEndsAt || p.promoEndsAt.getTime() > now.getTime();
}

export function tradePrice(input: {
  gross: number;
  discountBps: number;
  costNet: number | null;
  vatBps: number;
  floorMarginBps: number;
}): { gross: number; capped: boolean } {
  if (input.discountBps <= 0) return { gross: input.gross, capped: false };
  const target = Math.round((input.gross * (10000 - input.discountBps)) / 10000);
  if (input.costNet == null) return { gross: target, capped: false };
  const floorNet = Math.ceil((input.costNet * 10000) / (10000 - input.floorMarginBps));
  const floorGross = grossFromNet(floorNet, input.vatBps);
  if (target >= floorGross) return { gross: target, capped: false };
  return { gross: Math.min(input.gross, floorGross), capped: true };
}

/** The price a specific customer pays: the best of the regular, promotional and agreed trade price. */
export function priceForCustomer(
  product: PricedProductInput,
  customer: CustomerPricing | null,
  now: Date,
): CustomerPrice {
  const regular = product.retailPriceGross;
  let best = regular;
  let kind: CustomerPrice["kind"] = "regular";
  if (isPromoActive(product, now)) {
    const promo = Math.round((regular * (10000 - (product.promoBps ?? 0))) / 10000);
    if (promo < best) {
      best = promo;
      kind = "promo";
    }
  }
  if (customer && customer.tradeDiscountBps > 0) {
    const trade = tradePrice({
      gross: regular,
      discountBps: customer.tradeDiscountBps,
      costNet: product.refCostNet,
      vatBps: product.vatBps,
      floorMarginBps: customer.tradeFloorMarginBps,
    }).gross;
    if (trade < best) {
      best = trade;
      kind = "trade";
    }
  }
  return {
    unitGross: best,
    unitNet: netFromGross(best, product.vatBps),
    regularGross: regular,
    kind,
    savingGross: regular - best,
  };
}
