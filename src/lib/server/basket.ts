import "server-only";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { basketItems, baskets } from "@/lib/db/schema";
import { newToken } from "@/lib/ids";
import { getCurrentUser } from "./auth";
import { loadCatalog, toCard, type ProductCardData } from "./catalog";
import { priceContext, type Viewer } from "./context";
import { buildOrderDraft, type DraftResult } from "./orders";

export const BASKET_COOKIE = "tp_basket";
export const MAX_LINE_QUANTITY = 999;

export type BasketSource = NonNullable<(typeof basketItems.$inferSelect)["source"]>;

async function currentBasket(create: boolean): Promise<{ id: string } | null> {
  const user = await getCurrentUser();
  if (user) {
    const existing = await db.query.baskets.findFirst({ where: eq(baskets.userId, user.id), columns: { id: true } });
    if (existing || !create) return existing ?? null;
    const [created] = await db.insert(baskets).values({ token: newToken(18), userId: user.id }).returning({ id: baskets.id });
    return created;
  }
  const jar = await cookies();
  const token = jar.get(BASKET_COOKIE)?.value;
  if (token) {
    const existing = await db.query.baskets.findFirst({
      where: and(eq(baskets.token, token), isNull(baskets.userId)),
      columns: { id: true },
    });
    if (existing) return existing;
  }
  if (!create) return null;
  const freshToken = newToken(18);
  const [created] = await db.insert(baskets).values({ token: freshToken }).returning({ id: baskets.id });
  jar.set(BASKET_COOKIE, freshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 24 * 3600,
  });
  return created;
}

export const getBasketItems = cache(async () => {
  const basket = await currentBasket(false);
  if (!basket) return [];
  return db
    .select({ productId: basketItems.productId, quantity: basketItems.quantity, source: basketItems.source })
    .from(basketItems)
    .where(eq(basketItems.basketId, basket.id))
    .orderBy(asc(basketItems.addedAt));
});

export async function getBasketCount(): Promise<number> {
  const items = await getBasketItems();
  return items.reduce((n, i) => n + i.quantity, 0);
}

function clampQuantity(quantity: number): number {
  return Math.max(0, Math.min(MAX_LINE_QUANTITY, Math.floor(quantity)));
}

export async function addToBasket(items: { productId: string; quantity: number }[], source: BasketSource = "manual"): Promise<number> {
  const catalog = await loadCatalog();
  const valid = items
    .map((i) => ({ productId: i.productId, quantity: clampQuantity(i.quantity) }))
    .filter((i) => i.quantity > 0 && catalog.byId.has(i.productId));
  if (valid.length === 0) return 0;
  const basket = (await currentBasket(true))!;
  const [first, ...rest] = valid.map((i) =>
    db
      .insert(basketItems)
      .values({ basketId: basket.id, productId: i.productId, quantity: i.quantity, source })
      .onConflictDoUpdate({
        target: [basketItems.basketId, basketItems.productId],
        set: { quantity: sql`min(${basketItems.quantity} + excluded.quantity, ${MAX_LINE_QUANTITY})` },
      }),
  );
  await db.batch([first, ...rest]);
  return valid.length;
}

export async function setBasketQuantity(productId: string, quantity: number): Promise<void> {
  const basket = await currentBasket(false);
  if (!basket) return;
  const q = clampQuantity(quantity);
  const where = and(eq(basketItems.basketId, basket.id), eq(basketItems.productId, productId));
  if (q === 0) await db.delete(basketItems).where(where);
  else await db.update(basketItems).set({ quantity: q }).where(where);
}

export async function clearBasket(): Promise<void> {
  const basket = await currentBasket(false);
  if (basket) await db.delete(basketItems).where(eq(basketItems.basketId, basket.id));
}

/** Moves anything added before signing in into the account's basket. */
export async function mergeGuestBasket(userId: string): Promise<void> {
  const jar = await cookies();
  const token = jar.get(BASKET_COOKIE)?.value;
  if (!token) return;
  jar.delete(BASKET_COOKIE);
  const guest = await db.query.baskets.findFirst({
    where: and(eq(baskets.token, token), isNull(baskets.userId)),
    with: { items: true },
  });
  if (!guest) return;
  const target = await db.query.baskets.findFirst({ where: eq(baskets.userId, userId), columns: { id: true } });
  if (!target) {
    await db.update(baskets).set({ userId }).where(eq(baskets.id, guest.id));
    return;
  }
  for (const item of guest.items) {
    await db
      .insert(basketItems)
      .values({ basketId: target.id, productId: item.productId, quantity: item.quantity, source: item.source })
      .onConflictDoUpdate({
        target: [basketItems.basketId, basketItems.productId],
        set: { quantity: sql`min(${basketItems.quantity} + excluded.quantity, ${MAX_LINE_QUANTITY})` },
      });
  }
  await db.delete(baskets).where(eq(baskets.id, guest.id));
}

export type BasketLine = { card: ProductCardData; quantity: number; lineGross: number; source: BasketSource };

export type BasketView = {
  lines: BasketLine[];
  count: number;
  goodsGross: number;
  savingsGross: number;
  /** Delivery plan and totals, once we know where it's going. */
  draft: DraftResult | null;
};

export async function getBasketView(viewer: Viewer): Promise<BasketView> {
  const [items, catalog] = await Promise.all([getBasketItems(), loadCatalog()]);
  const ctx = priceContext(viewer);
  const lines = items.flatMap((i) => {
    const product = catalog.byId.get(i.productId);
    if (!product) return [];
    const card = toCard(product, catalog, ctx);
    const line: BasketLine = { card, quantity: i.quantity, lineGross: card.price.unitGross * i.quantity, source: i.source ?? "manual" };
    return [line];
  });
  const draft =
    viewer.postcode && lines.length > 0
      ? await buildOrderDraft(
          lines.map((l) => ({ productId: l.card.id, quantity: l.quantity })),
          { postcode: viewer.postcode.formatted, pricing: viewer.pricing, now: viewer.now },
        )
      : null;
  return {
    lines,
    count: lines.reduce((n, l) => n + l.quantity, 0),
    goodsGross: lines.reduce((s, l) => s + l.lineGross, 0),
    savingsGross: lines.reduce((s, l) => s + l.card.price.savingGross * l.quantity, 0),
    draft,
  };
}
