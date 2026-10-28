"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { addresses, orders } from "@/lib/db/schema";
import type { AddressSnapshot } from "@/lib/db/schema";
import { parsePostcode } from "@/lib/domain/postcode";
import { getCurrentUser } from "@/lib/server/auth";
import { clearBasket, getBasketItems } from "@/lib/server/basket";
import { getViewer } from "@/lib/server/context";
import { createOrder, buildOrderDraft, cancelUnpaidOrder } from "@/lib/server/orders";
import { createStripeCheckout, stripeConfigured } from "@/lib/server/payments";
import { clientIp, hitRateLimit } from "@/lib/server/rate-limit";

export type CheckoutResult = { ok: boolean; message: string } | null;

const AddressSchema = z.object({
  name: z.string().trim().min(2).max(120),
  line1: z.string().trim().min(3).max(120),
  line2: z.string().trim().max(120).optional(),
  town: z.string().trim().min(2).max(80),
  county: z.string().trim().max(80).optional(),
  postcode: z.string().trim().min(5).max(12),
  phone: z.string().trim().max(30).optional(),
  instructions: z.string().trim().max(400).optional(),
});

function snapshotFromForm(formData: FormData): { address: AddressSnapshot; error?: string } {
  const parsed = AddressSchema.safeParse({
    name: formData.get("name"),
    line1: formData.get("line1"),
    line2: formData.get("line2") || undefined,
    town: formData.get("town"),
    county: formData.get("county") || undefined,
    postcode: formData.get("postcode"),
    phone: formData.get("phone") || undefined,
    instructions: formData.get("instructions") || undefined,
  });
  if (!parsed.success) return { address: {} as AddressSnapshot, error: "Please check the delivery address — something's missing." };
  const postcode = parsePostcode(parsed.data.postcode);
  if (!postcode) return { address: {} as AddressSnapshot, error: "That doesn't look like a UK postcode." };
  return {
    address: {
      name: parsed.data.name,
      line1: parsed.data.line1,
      line2: parsed.data.line2 ?? null,
      town: parsed.data.town,
      county: parsed.data.county ?? null,
      postcode: postcode.formatted,
      phone: parsed.data.phone ?? null,
      instructions: parsed.data.instructions ?? null,
    },
  };
}

export async function placeOrderAction(_prev: CheckoutResult, formData: FormData): Promise<CheckoutResult> {
  const viewer = await getViewer();
  const items = await getBasketItems();
  if (items.length === 0) return { ok: false, message: "Your basket is empty." };

  const savedId = String(formData.get("addressId") ?? "");
  let address: AddressSnapshot;
  if (savedId && viewer.user) {
    const saved = await db.query.addresses.findFirst({ where: eq(addresses.id, savedId) });
    if (!saved || saved.userId !== viewer.user.id) return { ok: false, message: "That saved address isn't available." };
    address = {
      name: saved.name,
      line1: saved.line1,
      line2: saved.line2,
      town: saved.town,
      county: saved.county,
      postcode: saved.postcode,
      phone: saved.phone,
      instructions: saved.instructions,
    };
  } else {
    const parsed = snapshotFromForm(formData);
    if (parsed.error) return { ok: false, message: parsed.error };
    address = parsed.address;
  }

  const email = String(formData.get("email") ?? viewer.user?.email ?? "").trim().toLowerCase();
  const customerName = String(formData.get("customerName") ?? viewer.user?.name ?? address.name).trim();
  if (!z.email().safeParse(email).success) return { ok: false, message: "Enter a valid email so we can send your order confirmation." };
  if (customerName.length < 2) return { ok: false, message: "Enter the name for this order." };

  const limit = await hitRateLimit(`checkout:${await clientIp()}`, 8, 3600);
  if (!limit.ok) return { ok: false, message: "Too many checkout attempts. Please wait a while and try again." };

  const draft = await buildOrderDraft(items, { postcode: address.postcode, pricing: viewer.pricing, now: viewer.now });
  if (!draft.ok) {
    if (draft.reason === "zone_inactive") return { ok: false, message: "We don't deliver to that postcode yet." };
    if (draft.reason === "outside_area") return { ok: false, message: "That postcode is outside our current delivery area." };
    return { ok: false, message: "We couldn't price this basket for that postcode." };
  }
  if (draft.draft.unavailable.length > 0) {
    return {
      ok: false,
      message: `These items aren't available for ${address.postcode}: ${draft.draft.unavailable.map((l) => l.product.name).join(", ")}. Remove them to continue.`,
    };
  }

  const useStripe = stripeConfigured() && formData.get("pay") !== "demo";
  const saveAddress = formData.get("saveAddress") === "on" && viewer.user;
  const order = await createOrder(draft.draft, {
    userId: viewer.user?.id ?? null,
    email,
    name: customerName,
    phone: address.phone ?? viewer.user?.phone ?? null,
    companyName: viewer.user?.companyName,
    poReference: String(formData.get("poReference") ?? "").trim() || null,
    isTrade: viewer.user?.tradeStatus === "approved",
    address,
    provider: useStripe ? "stripe" : "demo",
    source: "web",
    customerNotes: String(formData.get("notes") ?? "").trim() || null,
  });

  if (saveAddress) {
    await db.insert(addresses).values({
      userId: viewer.user!.id,
      label: String(formData.get("addressLabel") ?? "Delivery").trim() || "Delivery",
      name: address.name,
      line1: address.line1,
      line2: address.line2,
      town: address.town,
      county: address.county,
      postcode: address.postcode,
      phone: address.phone,
      instructions: address.instructions,
    });
  }

  await clearBasket();

  if (useStripe) {
    const session = await createStripeCheckout({
      id: order.id,
      number: order.number,
      email,
      deliveryGross: draft.draft.deliveryGross,
      deliveryCount: draft.draft.plan.shipments.length,
      lines: draft.draft.lines.map((l) => ({ name: l.product.name, quantity: l.quantity, unitGross: l.price.unitGross })),
    });
    redirect(session.url);
  }

  const { markOrderPaid } = await import("@/lib/server/orders");
  await markOrderPaid(order.id, { provider: "demo", reference: `demo_${order.number}`, amountGross: draft.draft.totalGross });
  redirect(`/checkout/complete/${order.number}?t=${order.trackingToken}`);
}

export async function cancelCheckoutAction(formData: FormData): Promise<void> {
  const number = String(formData.get("number") ?? "");
  const user = await getCurrentUser();
  const order = await db.query.orders.findFirst({ where: eq(orders.number, number) });
  if (!order) return;
  if (order.userId && order.userId !== user?.id) return;
  await cancelUnpaidOrder(order.id, user?.name ?? "customer");
  redirect("/basket");
}
