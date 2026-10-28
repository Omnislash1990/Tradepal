import "server-only";
import { asc, eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/lib/db";
import { categories, products, suppliers, type supplierOffers } from "@/lib/db/schema";
import type { DeliveryClass } from "@/lib/domain/delivery";
import { formatGBP } from "@/lib/domain/money";
import { priceForCustomer, type CustomerPrice, type CustomerPricing } from "@/lib/domain/pricing";
import { prepareDocs, searchDocs, type PreparedDoc } from "@/lib/domain/search";
import { supplierServesArea } from "@/lib/domain/sourcing";

export type ProductRow = typeof products.$inferSelect;
export type CategoryRow = typeof categories.$inferSelect;
export type SupplierRow = typeof suppliers.$inferSelect;
export type OfferRow = typeof supplierOffers.$inferSelect;
export type CatalogProduct = ProductRow & { category: CategoryRow; offers: OfferRow[] };

export const loadCatalog = cache(async () => {
  const [productRows, supplierRows, categoryRows] = await Promise.all([
    db.query.products.findMany({ where: eq(products.active, true), with: { category: true, offers: true } }),
    db.select().from(suppliers),
    db.select().from(categories).orderBy(asc(categories.sortOrder)),
  ]);
  const items = productRows as CatalogProduct[];
  return {
    products: items,
    categories: categoryRows,
    suppliers: supplierRows,
    supplierById: new Map(supplierRows.map((s) => [s.id, s])),
    bySlug: new Map(items.map((p) => [p.slug, p])),
    bySku: new Map(items.map((p) => [p.sku, p])),
    byId: new Map(items.map((p) => [p.id, p])),
  };
});

export type Catalog = Awaited<ReturnType<typeof loadCatalog>>;

export type Availability = {
  status: "in_stock" | "low_stock" | "unverified" | "out_of_stock";
  /** Stock confirmed by a supplier feed in the last sync. */
  verified: boolean;
  supplierCount: number;
  fastestLeadDays: number | null;
  label: string;
};

export function availabilityFor(product: CatalogProduct, catalog: Catalog, area?: string | null): Availability {
  const live = product.offers.filter((o) => {
    const supplier = catalog.supplierById.get(o.supplierId);
    if (!o.active || !supplier?.active || o.stockStatus === "out_of_stock") return false;
    return !area || supplierServesArea(supplier, area);
  });
  if (live.length === 0) {
    const elsewhere = area && product.offers.some((o) => o.active && o.stockStatus !== "out_of_stock");
    return {
      status: "out_of_stock",
      verified: false,
      supplierCount: 0,
      fastestLeadDays: null,
      label: elsewhere ? "Not available for your postcode" : "Out of stock",
    };
  }
  const lead = (o: OfferRow) => o.leadTimeDays ?? catalog.supplierById.get(o.supplierId)?.leadTimeDays ?? 3;
  const confirmed = live.filter((o) => o.verified && o.stockStatus !== "unknown");
  const fastestLeadDays = Math.min(...live.map(lead));
  if (confirmed.length === 0) {
    return { status: "unverified", verified: false, supplierCount: live.length, fastestLeadDays, label: "Available to order — stock confirmed after ordering" };
  }
  const low = confirmed.every((o) => o.stockStatus === "low_stock");
  return {
    status: low ? "low_stock" : "in_stock",
    verified: true,
    supplierCount: live.length,
    fastestLeadDays: Math.min(...confirmed.map(lead)),
    label: low ? "Low stock — verified today" : "In stock — verified",
  };
}

export type ProductCardData = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  unit: string;
  imageKey: ProductRow["imageKey"];
  imageUrl: string | null;
  categorySlug: string;
  categoryName: string;
  vatBps: number;
  deliveryClass: DeliveryClass;
  price: CustomerPrice;
  availability: Availability;
  promoEndsAt: Date | null;
  popularity: number;
};

export function toCard(
  p: CatalogProduct,
  catalog: Catalog,
  ctx: { pricing: CustomerPricing | null; area: string | null; now: Date },
): ProductCardData {
  return {
    id: p.id,
    sku: p.sku,
    slug: p.slug,
    name: p.name,
    unit: p.unit,
    imageKey: p.imageKey,
    imageUrl: p.imageUrl,
    categorySlug: p.category.slug,
    categoryName: p.category.name,
    vatBps: p.vatBps,
    deliveryClass: p.deliveryClass,
    price: priceForCustomer(p, ctx.pricing, ctx.now),
    availability: availabilityFor(p, catalog, ctx.area),
    promoEndsAt: p.promoEndsAt,
    popularity: p.popularity,
  };
}

const searchIndex = cache(async () => {
  const catalog = await loadCatalog();
  return prepareDocs(
    catalog.products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      brand: null,
      categoryName: p.category.name,
      tags: p.tags,
      description: p.description,
      popularity: p.popularity,
    })),
  );
});

export async function rankProducts(query: string, limit = 60): Promise<{ id: string; score: number }[]> {
  const docs: PreparedDoc[] = await searchIndex();
  return searchDocs(docs, query, limit).map((r) => ({ id: r.doc.id, score: r.score }));
}

export type CatalogSort = "popular" | "price-asc" | "price-desc" | "name" | "relevance";
export type AvailabilityFilter = "all" | "in-stock" | "verified";

export type ProductQuery = {
  categorySlug?: string | null;
  q?: string | null;
  sort?: CatalogSort;
  availability?: AvailabilityFilter;
  deliveryClass?: DeliveryClass | null;
  onOffer?: boolean;
  maxPriceGross?: number | null;
};

export async function queryProducts(
  query: ProductQuery,
  ctx: { pricing: CustomerPricing | null; area: string | null; now: Date },
): Promise<{ items: ProductCardData[]; total: number; ranked: boolean }> {
  const catalog = await loadCatalog();
  let pool = catalog.products;
  let scores: Map<string, number> | null = null;
  if (query.q?.trim()) {
    const ranked = await rankProducts(query.q, 200);
    scores = new Map(ranked.map((r) => [r.id, r.score]));
    pool = ranked.map((r) => catalog.byId.get(r.id)!).filter(Boolean);
  }
  if (query.categorySlug) pool = pool.filter((p) => p.category.slug === query.categorySlug);
  if (query.deliveryClass) pool = pool.filter((p) => p.deliveryClass === query.deliveryClass);

  let cards = pool.map((p) => toCard(p, catalog, ctx));
  if (query.availability === "in-stock") cards = cards.filter((c) => c.availability.status !== "out_of_stock");
  if (query.availability === "verified") cards = cards.filter((c) => c.availability.verified);
  if (query.onOffer) cards = cards.filter((c) => c.price.kind === "promo");
  if (query.maxPriceGross) cards = cards.filter((c) => c.price.unitGross <= query.maxPriceGross!);

  const sort = query.sort ?? (scores ? "relevance" : "popular");
  const byName = (a: ProductCardData, b: ProductCardData) => a.name.localeCompare(b.name);
  cards.sort((a, b) => {
    switch (sort) {
      case "price-asc":
        return a.price.unitGross - b.price.unitGross;
      case "price-desc":
        return b.price.unitGross - a.price.unitGross;
      case "name":
        return byName(a, b);
      case "relevance":
        if (scores) return (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0);
        return b.popularity - a.popularity;
      default:
        return b.popularity - a.popularity || byName(a, b);
    }
  });
  return { items: cards, total: cards.length, ranked: !!scores };
}

export type Alternative = { card: ProductCardData; differences: string[] };

/** Products that could be used instead, with what's different spelled out. */
export function alternativesFor(
  product: CatalogProduct,
  catalog: Catalog,
  ctx: { pricing: CustomerPricing | null; area: string | null; now: Date },
): Alternative[] {
  const candidates = product.family
    ? catalog.products.filter((p) => p.family === product.family && p.id !== product.id)
    : catalog.products.filter(
        (p) =>
          p.id !== product.id &&
          p.categoryId === product.categoryId &&
          p.tags.filter((t) => product.tags.includes(t)).length >= 2,
      );
  const base = toCard(product, catalog, ctx);
  return candidates
    .map((p) => {
      const card = toCard(p, catalog, ctx);
      const differences: string[] = [];
      if (p.altNote) differences.push(p.altNote);
      const diff = card.price.unitGross - base.price.unitGross;
      if (diff !== 0) differences.push(`${formatGBP(Math.abs(diff))} ${diff < 0 ? "cheaper" : "more"} per ${p.unit}`);
      if (base.availability.status === "out_of_stock" && card.availability.status !== "out_of_stock") differences.push("Available now");
      if (card.availability.status === "out_of_stock") differences.push("Currently out of stock");
      if (p.deliveryClass !== product.deliveryClass) differences.push(`${p.deliveryClass === "heavy" ? "Heavy goods" : p.deliveryClass === "parcel" ? "Parcel" : "Van"} delivery`);
      return { card, differences };
    })
    .sort((a, b) => Number(b.card.availability.status !== "out_of_stock") - Number(a.card.availability.status !== "out_of_stock") || b.card.popularity - a.card.popularity)
    .slice(0, 4);
}

export function compatibleFor(
  product: CatalogProduct,
  catalog: Catalog,
  ctx: { pricing: CustomerPricing | null; area: string | null; now: Date },
): ProductCardData[] {
  return product.compatibleSkus
    .map((sku) => catalog.bySku.get(sku))
    .filter((p): p is CatalogProduct => !!p)
    .map((p) => toCard(p, catalog, ctx));
}
