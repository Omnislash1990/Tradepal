import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { pricingRules, products, supplierOffers, suppliers } from "@/lib/db/schema";
import { calculateRetailPrice, pickPricingRule, type PricingRule } from "@/lib/domain/pricing";

type OfferRow = typeof supplierOffers.$inferSelect;

export type PriceChange = {
  productId: string;
  sku: string;
  name: string;
  oldGross: number;
  newGross: number;
  costNet: number | null;
  marginBps: number | null;
  ruleId: string | null;
  ruleName: string;
  source: "override" | "rule" | "no-cost";
};

/**
 * The cost a price is based on: the cheapest offer that isn't out of stock from an active supplier,
 * or the cheapest active offer if none are in stock.
 */
export function referenceOffer(offers: OfferRow[], activeSupplierIds: Set<string>): OfferRow | null {
  const usable = offers.filter((o) => o.active && activeSupplierIds.has(o.supplierId));
  const inStock = usable.filter((o) => o.stockStatus !== "out_of_stock");
  const pool = inStock.length ? inStock : usable;
  return pool.sort((a, b) => a.costNet - b.costNet)[0] ?? null;
}

export async function computePriceChanges(opts: { productIds?: string[]; rules?: PricingRule[] } = {}): Promise<PriceChange[]> {
  const [productRows, offerRows, supplierRows, ruleRows] = await Promise.all([
    opts.productIds ? db.select().from(products).where(inArray(products.id, opts.productIds)) : db.select().from(products),
    opts.productIds
      ? db.select().from(supplierOffers).where(inArray(supplierOffers.productId, opts.productIds))
      : db.select().from(supplierOffers),
    db.select().from(suppliers),
    opts.rules ? Promise.resolve(opts.rules) : db.select().from(pricingRules),
  ]);
  const activeSuppliers = new Set(supplierRows.filter((s) => s.active).map((s) => s.id));
  const offersByProduct = new Map<string, OfferRow[]>();
  for (const offer of offerRows) {
    const list = offersByProduct.get(offer.productId) ?? [];
    list.push(offer);
    offersByProduct.set(offer.productId, list);
  }
  const rules = ruleRows as PricingRule[];
  const ruleName = new Map(rules.map((r) => [r.id, r.name]));

  return productRows.map((p) => {
    const ref = referenceOffer(offersByProduct.get(p.id) ?? [], activeSuppliers);
    if (!ref && p.priceOverrideGross == null) {
      return {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        oldGross: p.retailPriceGross,
        newGross: p.retailPriceGross,
        costNet: null,
        marginBps: null,
        ruleId: null,
        ruleName: "No supplier cost",
        source: "no-cost" as const,
      };
    }
    const rule = pickPricingRule(rules, { categoryId: p.categoryId, supplierId: ref?.supplierId ?? null });
    const calc = calculateRetailPrice({
      costNet: ref?.costNet ?? 0,
      vatBps: p.vatBps,
      rule,
      overrideGross: p.priceOverrideGross,
    });
    return {
      productId: p.id,
      sku: p.sku,
      name: p.name,
      oldGross: p.retailPriceGross,
      newGross: calc.grossPrice,
      costNet: ref?.costNet ?? null,
      marginBps: ref ? calc.marginBps : null,
      ruleId: calc.ruleId,
      ruleName: calc.source === "override" ? "Manual price" : calc.ruleId ? (ruleName.get(calc.ruleId) ?? "Rule") : "Default markup",
      source: calc.source,
    };
  });
}

export async function applyPriceChanges(changes: PriceChange[]): Promise<number> {
  const now = new Date();
  const updates = changes
    .filter((c) => c.source !== "no-cost")
    .map((c) =>
      db
        .update(products)
        .set({
          retailPriceGross: c.newGross,
          refCostNet: c.costNet,
          marginBps: c.marginBps,
          pricingRuleId: c.ruleId,
          priceUpdatedAt: now,
        })
        .where(eq(products.id, c.productId)),
    );
  if (updates.length === 0) return 0;
  const [first, ...rest] = updates;
  await db.batch([first, ...rest]);
  return changes.filter((c) => c.oldGross !== c.newGross).length;
}

export async function repriceProducts(productIds?: string[]): Promise<PriceChange[]> {
  const changes = await computePriceChanges({ productIds });
  await applyPriceChanges(changes);
  return changes;
}
