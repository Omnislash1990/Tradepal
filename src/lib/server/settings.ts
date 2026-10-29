import "server-only";
import { cache } from "react";
import { db, ensureDatabase } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { DEFAULT_BANK_HOLIDAYS } from "@/lib/domain/delivery";

export type BusinessSettings = {
  tradingName: string;
  legalName: string;
  companyNumber: string;
  vatNumber: string;
  vatRegistered: boolean;
  address: string;
  email: string;
  phone: string;
};

export type CommerceSettings = {
  /** Card processing fee used for contribution estimates (UK cards on Stripe are 1.5% + 20p). */
  paymentFeeBps: number;
  paymentFeeFixed: number;
  defaultTradeDiscountBps: number;
  /** Trade discounts never take an item's margin below this. */
  tradeFloorMarginBps: number;
  /** Send purchase orders to suppliers automatically once an order is paid. */
  autoSendPurchaseOrders: boolean;
  /** Orders above this total are held for a person to check before purchase orders go out. */
  manualReviewOverGross: number;
  quoteValidityDays: number;
};

export type AiSettings = {
  /** Language-model calls per day across the whole site. Rule-based answers are unlimited. */
  dailyLlmLimit: number;
  /** Assistant messages per visitor per hour. */
  visitorHourlyLimit: number;
  llmEnabled: boolean;
  /** Provider prices in pence per million tokens, used to track spend. */
  inputPencePerMillion: number;
  outputPencePerMillion: number;
};

export type DeliverySettings = { bankHolidays: string[] };

/** Launch items only a person can confirm (legal review, rates agreed…). */
export type LaunchSettings = { confirmed: Record<string, boolean> };

export type AppSettings = {
  business: BusinessSettings;
  commerce: CommerceSettings;
  ai: AiSettings;
  delivery: DeliverySettings;
  launch: LaunchSettings;
};

export const DEFAULT_SETTINGS: AppSettings = {
  business: {
    tradingName: "Tradepal",
    legalName: "",
    companyNumber: "",
    vatNumber: "",
    vatRegistered: true,
    address: "",
    email: "hello@tradepal.example",
    phone: "",
  },
  commerce: {
    paymentFeeBps: 150,
    paymentFeeFixed: 20,
    defaultTradeDiscountBps: 500,
    tradeFloorMarginBps: 1200,
    autoSendPurchaseOrders: true,
    manualReviewOverGross: 200000,
    quoteValidityDays: 30,
  },
  ai: { dailyLlmLimit: 500, visitorHourlyLimit: 40, llmEnabled: true, inputPencePerMillion: 0, outputPencePerMillion: 0 },
  delivery: { bankHolidays: DEFAULT_BANK_HOLIDAYS },
  launch: { confirmed: {} },
};

export const getSettings = cache(async (): Promise<AppSettings> => {
  await ensureDatabase();
  const rows = await db.select().from(settings);
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Partial<AppSettings>;
  return {
    business: { ...DEFAULT_SETTINGS.business, ...stored.business },
    commerce: { ...DEFAULT_SETTINGS.commerce, ...stored.commerce },
    ai: { ...DEFAULT_SETTINGS.ai, ...stored.ai },
    delivery: { ...DEFAULT_SETTINGS.delivery, ...stored.delivery },
    launch: { confirmed: { ...stored.launch?.confirmed } },
  };
});

export async function saveSettings<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}
