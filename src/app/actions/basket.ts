"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { waitlist } from "@/lib/db/schema";
import { parsePostcode } from "@/lib/domain/postcode";
import { markEstimateAdded } from "@/lib/server/assistant";
import { addToBasket, clearBasket, setBasketQuantity, type BasketSource } from "@/lib/server/basket";
import { getViewer, POSTCODE_COOKIE, VAT_COOKIE } from "@/lib/server/context";
import { resolveZone } from "@/lib/server/orders";
import { hitRateLimit, clientIp } from "@/lib/server/rate-limit";

export type ActionResult = { ok: boolean; message: string } | null;

const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 365 * 24 * 3600 };

export async function addToBasketAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const productId = String(formData.get("productId") ?? "");
  const quantity = Number(formData.get("quantity") ?? 1);
  const added = await addToBasket([{ productId, quantity: Number.isFinite(quantity) ? quantity : 1 }], "manual");
  if (!added) return { ok: false, message: "That item couldn't be added." };
  refresh();
  return { ok: true, message: quantity > 1 ? `${quantity} added to your basket` : "Added to your basket" };
}

const ItemsSchema = z.array(z.object({ productId: z.string().min(1).max(64), quantity: z.number().int().min(1).max(999) })).min(1).max(100);

export async function addItemsAction(
  items: { productId: string; quantity: number }[],
  source: Extract<BasketSource, "assistant" | "list" | "reorder" | "quote">,
): Promise<ActionResult> {
  const parsed = ItemsSchema.safeParse(items);
  if (!parsed.success) return { ok: false, message: "Nothing to add." };
  const added = await addToBasket(parsed.data, source);
  if (source === "assistant" && added) {
    const viewer = await getViewer();
    await markEstimateAdded(viewer.visitorId);
  }
  refresh();
  return added ? { ok: true, message: `${added} ${added === 1 ? "item" : "items"} added to your basket` } : { ok: false, message: "Those items aren't available." };
}

export async function updateQuantityAction(formData: FormData): Promise<void> {
  const productId = String(formData.get("productId") ?? "");
  const quantity = Number(formData.get("quantity"));
  if (productId && Number.isFinite(quantity)) await setBasketQuantity(productId, quantity);
  refresh();
}

export async function removeItemAction(formData: FormData): Promise<void> {
  const productId = String(formData.get("productId") ?? "");
  if (productId) await setBasketQuantity(productId, 0);
  refresh();
}

export async function clearBasketAction(): Promise<void> {
  await clearBasket();
  refresh();
}

export type PostcodeResult = {
  ok: boolean;
  status: "covered" | "coming_soon" | "outside" | "invalid" | "cleared";
  message: string;
  postcode?: string;
} | null;

export async function setPostcodeAction(_prev: PostcodeResult, formData: FormData): Promise<PostcodeResult> {
  const jar = await cookies();
  const raw = String(formData.get("postcode") ?? "").trim();
  if (!raw) {
    jar.delete(POSTCODE_COOKIE);
    refresh();
    return { ok: true, status: "cleared", message: "Postcode cleared." };
  }
  const postcode = parsePostcode(raw);
  if (!postcode) return { ok: false, status: "invalid", message: "That doesn't look like a UK postcode. Try something like B15 2TT." };
  const zone = await resolveZone(postcode.formatted);
  jar.set(POSTCODE_COOKIE, postcode.formatted, cookieOptions);
  refresh();
  if (zone.ok) {
    return { ok: true, status: "covered", postcode: postcode.formatted, message: `Good news — we deliver to ${postcode.formatted}.` };
  }
  if (zone.reason === "zone_inactive") {
    return {
      ok: false,
      status: "coming_soon",
      postcode: postcode.formatted,
      message: `We're not delivering to ${postcode.outward} yet, but it's next on our list. Join the waiting list and we'll tell you when we launch.`,
    };
  }
  return {
    ok: false,
    status: "outside",
    postcode: postcode.formatted,
    message: `We don't deliver to ${postcode.outward} yet — we're starting in Birmingham, the Black Country and Coventry. Join the waiting list to hear when we expand.`,
  };
}

export async function setVatModeAction(formData: FormData): Promise<void> {
  const mode = formData.get("mode") === "ex" ? "ex" : "inc";
  (await cookies()).set(VAT_COOKIE, mode, cookieOptions);
  refresh();
}

export async function joinWaitlistAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const postcode = parsePostcode(String(formData.get("postcode") ?? ""));
  if (!z.email().safeParse(email).success) return { ok: false, message: "Please enter a valid email address." };
  if (!postcode) return { ok: false, message: "Please enter your postcode." };
  const limit = await hitRateLimit(`waitlist:${await clientIp()}`, 10, 3600);
  if (!limit.ok) return { ok: false, message: "Too many attempts — please try again later." };
  await db.insert(waitlist).values({ email, postcode: postcode.formatted, area: postcode.area });
  return { ok: true, message: `Thanks — we'll email ${email} when we deliver to ${postcode.outward}.` };
}
