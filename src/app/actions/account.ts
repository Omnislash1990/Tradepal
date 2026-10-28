"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { addresses, listItems, lists, orders, quotes, returnRequests, tradeAccounts, users } from "@/lib/db/schema";
import type { AddressSnapshot } from "@/lib/db/schema";
import { parsePostcode } from "@/lib/domain/postcode";
import { newReference } from "@/lib/ids";
import { requireUser } from "@/lib/server/auth";
import { addToBasket, getBasketItems } from "@/lib/server/basket";
import { getViewer } from "@/lib/server/context";
import { sendEmail } from "@/lib/server/notify";
import { buildOrderDraft } from "@/lib/server/orders";
import { getSettings } from "@/lib/server/settings";
import { audit } from "@/lib/server/audit";

export type AccountResult = { ok: boolean; message: string } | null;

function readAddress(formData: FormData): { data: AddressSnapshot & { label?: string; isDefault?: boolean }; error?: string } {
  const name = String(formData.get("name") ?? "").trim();
  const line1 = String(formData.get("line1") ?? "").trim();
  const town = String(formData.get("town") ?? "").trim();
  const postcode = parsePostcode(String(formData.get("postcode") ?? ""));
  if (!name || !line1 || !town || !postcode) return { data: {} as AddressSnapshot, error: "Name, address, town and a valid UK postcode are required." };
  return {
    data: {
      name,
      line1,
      line2: String(formData.get("line2") ?? "").trim() || null,
      town,
      county: String(formData.get("county") ?? "").trim() || null,
      postcode: postcode.formatted,
      phone: String(formData.get("phone") ?? "").trim() || null,
      instructions: String(formData.get("instructions") ?? "").trim() || null,
      label: String(formData.get("label") ?? "").trim() || "Address",
      isDefault: formData.get("isDefault") === "on",
    },
  };
}

export async function saveAddressAction(_prev: AccountResult, formData: FormData): Promise<AccountResult> {
  const user = await requireUser("/account/addresses");
  const parsed = readAddress(formData);
  if (parsed.error) return { ok: false, message: parsed.error };
  const id = String(formData.get("id") ?? "");
  if (parsed.data.isDefault) {
    await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, user.id));
  }
  const values = {
    label: parsed.data.label,
    name: parsed.data.name,
    line1: parsed.data.line1,
    line2: parsed.data.line2,
    town: parsed.data.town,
    county: parsed.data.county,
    postcode: parsed.data.postcode,
    phone: parsed.data.phone,
    instructions: parsed.data.instructions,
    isDefault: !!parsed.data.isDefault,
  };
  if (id) {
    await db.update(addresses).set(values).where(and(eq(addresses.id, id), eq(addresses.userId, user.id)));
  } else {
    await db.insert(addresses).values({ userId: user.id, ...values });
  }
  refresh();
  return { ok: true, message: "Address saved." };
}

export async function deleteAddressAction(formData: FormData): Promise<void> {
  const user = await requireUser("/account/addresses");
  const id = String(formData.get("id") ?? "");
  if (id) await db.delete(addresses).where(and(eq(addresses.id, id), eq(addresses.userId, user.id)));
  refresh();
}

export async function createListAction(_prev: AccountResult, formData: FormData): Promise<AccountResult> {
  const user = await requireUser("/account/lists");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, message: "Give the list a name." };
  const kind = formData.get("kind") === "job" ? "job" : "saved";
  const [row] = await db.insert(lists).values({ userId: user.id, name, kind }).returning({ id: lists.id });
  redirect(`/account/lists/${row.id}`);
}

export async function addBasketToListAction(formData: FormData): Promise<void> {
  const user = await requireUser("/account/lists");
  const listId = String(formData.get("listId") ?? "");
  const list = await db.query.lists.findFirst({ where: and(eq(lists.id, listId), eq(lists.userId, user.id)) });
  if (!list) return;
  const items = await getBasketItems();
  for (const item of items) {
    await db
      .insert(listItems)
      .values({ listId, productId: item.productId, quantity: item.quantity })
      .onConflictDoUpdate({
        target: [listItems.listId, listItems.productId],
        set: { quantity: item.quantity },
      });
  }
  refresh();
}

export async function addListToBasketAction(formData: FormData): Promise<void> {
  const user = await requireUser("/account/lists");
  const listId = String(formData.get("listId") ?? "");
  const list = await db.query.lists.findFirst({
    where: and(eq(lists.id, listId), eq(lists.userId, user.id)),
    with: { items: true },
  });
  if (!list) return;
  await addToBasket(
    list.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    "list",
  );
  redirect("/basket");
}

export async function deleteListAction(formData: FormData): Promise<void> {
  const user = await requireUser("/account/lists");
  const id = String(formData.get("id") ?? "");
  if (id) await db.delete(lists).where(and(eq(lists.id, id), eq(lists.userId, user.id)));
  refresh();
}

export async function quoteFromBasketAction(): Promise<void> {
  const user = await requireUser("/account/quotes");
  if (user.tradeStatus !== "approved") redirect("/account/quotes");
  const viewer = await getViewer();
  const items = await getBasketItems();
  if (items.length === 0) redirect("/basket");
  const postcode = viewer.postcode?.formatted ?? (await db.query.addresses.findFirst({ where: eq(addresses.userId, user.id) }))?.postcode;
  const draft = await buildOrderDraft(items, { postcode, pricing: viewer.pricing, now: viewer.now });
  if (!draft.ok) redirect("/basket");
  const settings = await getSettings();
  const [row] = await db
    .insert(quotes)
    .values({
      number: newReference("Q", 5),
      userId: user.id,
      reference: String("Basket quote"),
      lines: draft.draft.lines.map((l) => ({
        productId: l.product.id,
        sku: l.product.sku,
        name: l.product.name,
        quantity: l.quantity,
        unitGross: l.price.unitGross,
        vatBps: l.product.vatBps,
      })),
      goodsGross: draft.draft.goodsGross,
      deliveryGross: draft.draft.deliveryGross,
      postcode: draft.draft.postcode.formatted,
      validUntil: new Date(Date.now() + settings.commerce.quoteValidityDays * 86400000),
    })
    .returning({ id: quotes.id, number: quotes.number });
  redirect(`/account/quotes/${row.id}`);
}

export async function addQuoteToBasketAction(formData: FormData): Promise<void> {
  const user = await requireUser("/account/quotes");
  const id = String(formData.get("id") ?? "");
  const quote = await db.query.quotes.findFirst({ where: and(eq(quotes.id, id), eq(quotes.userId, user.id)) });
  if (!quote) return;
  await addToBasket(
    quote.lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
    "quote",
  );
  redirect("/basket");
}

export async function applyTradeAction(_prev: AccountResult, formData: FormData): Promise<AccountResult> {
  const user = await requireUser("/trade");
  const companyName = String(formData.get("companyName") ?? "").trim();
  const tradeType = String(formData.get("tradeType") ?? "").trim();
  if (companyName.length < 2 || tradeType.length < 2) return { ok: false, message: "Company name and trade type are required." };
  const existing = await db.query.tradeAccounts.findFirst({ where: eq(tradeAccounts.userId, user.id) });
  if (existing && existing.status !== "rejected") {
    return { ok: false, message: existing.status === "approved" ? "Your trade account is already approved." : "We've already got an application from you." };
  }
  const values = {
    companyName,
    companyNumber: String(formData.get("companyNumber") ?? "").trim() || null,
    vatNumber: String(formData.get("vatNumber") ?? "").trim() || null,
    tradeType,
    phone: String(formData.get("phone") ?? "").trim() || user.phone,
    monthlySpend: String(formData.get("monthlySpend") ?? "").trim() || null,
    status: "pending" as const,
  };
  if (existing) await db.update(tradeAccounts).set(values).where(eq(tradeAccounts.id, existing.id));
  else await db.insert(tradeAccounts).values({ userId: user.id, ...values });
  await db.update(users).set({ accountType: "trade", tradeStatus: "pending" }).where(eq(users.id, user.id));
  await sendEmail({
    to: user.email,
    subject: "Trade account application received",
    template: "trade_application",
    userId: user.id,
    body: `Hi ${user.name.split(" ")[0]},\n\nThanks for applying for a Tradepal trade account for ${companyName}. We'll review it and email you when it's approved.\n\nTrade pricing is only applied after approval.`,
  });
  await audit(user, { action: "trade.apply", entity: "trade_account", summary: `Trade application from ${companyName}` });
  return { ok: true, message: "Application sent. We'll email you once it's been reviewed." };
}

export async function requestReturnAction(formData: FormData): Promise<void> {
  const user = await requireUser("/account/orders");
  const orderId = String(formData.get("orderId") ?? "");
  const reason = String(formData.get("reason") ?? "other") as "changed_mind" | "damaged" | "wrong_item" | "faulty" | "other";
  const details = String(formData.get("details") ?? "").trim() || null;
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId), with: { lines: true } });
  if (!order || order.userId !== user.id) return;
  const lines = order.lines.filter((l) => l.status === "active").map((l) => ({ lineId: l.id, quantity: l.quantity }));
  await db.insert(returnRequests).values({ orderId, userId: user.id, lines, reason, details });
  refresh();
}

export async function reorderAction(formData: FormData): Promise<void> {
  const user = await requireUser("/account/orders");
  const orderId = String(formData.get("orderId") ?? "");
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId), with: { lines: true } });
  if (!order || order.userId !== user.id) return;
  await addToBasket(
    order.lines.filter((l) => l.status === "active" && l.productId).map((l) => ({ productId: l.productId!, quantity: l.quantity })),
    "reorder",
  );
  redirect("/basket");
}
