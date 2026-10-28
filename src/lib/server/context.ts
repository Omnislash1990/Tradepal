import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";
import type { CustomerPricing } from "@/lib/domain/pricing";
import { parsePostcode, type ParsedPostcode } from "@/lib/domain/postcode";
import { getCurrentUser, type CurrentUser } from "./auth";
import { getSettings } from "./settings";

export const VAT_COOKIE = "tp_vat";
export const POSTCODE_COOKIE = "tp_postcode";
export const VISITOR_COOKIE = "tp_vid";

export type Viewer = {
  user: CurrentUser | null;
  pricing: CustomerPricing | null;
  /** Show prices excluding VAT (trade preference); checkout totals always include it. */
  exVat: boolean;
  postcode: ParsedPostcode | null;
  area: string | null;
  visitorId: string;
  now: Date;
};

export const getViewer = cache(async (): Promise<Viewer> => {
  await connection();
  const jar = await cookies();
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);
  const pricing =
    user?.tradeStatus === "approved" && user.tradeDiscountBps > 0
      ? { tradeDiscountBps: user.tradeDiscountBps, tradeFloorMarginBps: settings.commerce.tradeFloorMarginBps }
      : null;
  const vatPref = jar.get(VAT_COOKIE)?.value;
  const postcode = parsePostcode(jar.get(POSTCODE_COOKIE)?.value);
  return {
    user,
    pricing,
    exVat: vatPref ? vatPref === "ex" : !!user?.pricesExVat,
    postcode,
    area: postcode?.area ?? null,
    visitorId: jar.get(VISITOR_COOKIE)?.value ?? "anonymous",
    now: new Date(),
  };
});

export function priceContext(viewer: Viewer) {
  return { pricing: viewer.pricing, area: viewer.area, now: viewer.now };
}
