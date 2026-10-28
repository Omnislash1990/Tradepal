import "server-only";
import { and, count, desc, eq, gte, isNotNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { aiUsage, searchLogs } from "@/lib/db/schema";
import {
  INITIAL_STATE,
  interpretWithRules,
  JOB_STARTERS,
  respond,
  type AssistantReply,
  type AssistantState,
} from "@/lib/domain/assistant/engine";
import type { Estimate, EstimateLine, MaterialLookup } from "@/lib/domain/estimator/types";
import { priceForCustomer } from "@/lib/domain/pricing";
import { detectJobInQuery } from "@/lib/domain/search";
import { availabilityFor, loadCatalog, rankProducts, toCard, type Availability, type Catalog } from "./catalog";
import { priceContext, type Viewer } from "./context";
import { interpretWithLlm, JOB_TYPES, llmConfig } from "./llm";
import { hitRateLimit } from "./rate-limit";
import { getSettings } from "./settings";

export const MAX_MESSAGE_LENGTH = 500;

const positive = z.number().positive().max(10000);
export const StateSchema = z.object({
  job: z
    .object({
      type: z.enum(JOB_TYPES),
      inputs: z
        .object({
          lengthM: positive,
          widthM: positive,
          heightM: positive,
          areaM2: positive,
          depthMm: positive,
          runLengthM: positive,
          doors: z.number().int().min(0).max(50),
          windows: z.number().int().min(0).max(50),
        })
        .partial(),
      options: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
    })
    .nullable(),
  awaiting: z.enum(["lengthM", "widthM", "heightM", "areaM2", "runLengthM", "surface", "existingInsulationMm"]).nullable(),
});

export type ProductSummary = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  unit: string;
  imageKey: string;
  unitGross: number;
  regularGross: number;
  vatBps: number;
  priceKind: "regular" | "promo" | "trade";
  availability: Pick<Availability, "status" | "label">;
};

export type EstimateLineView = EstimateLine & { product: ProductSummary | null };
export type EstimateView = Omit<Estimate, "lines"> & { lines: EstimateLineView[] };

export type AssistantTurn = {
  reply: Omit<AssistantReply, "estimate"> & { estimate: EstimateView | null };
  state: AssistantState;
  products: ProductSummary[];
  limited: boolean;
};

function summary(product: Catalog["products"][number], catalog: Catalog, viewer: Viewer): ProductSummary {
  const card = toCard(product, catalog, priceContext(viewer));
  return {
    id: card.id,
    slug: card.slug,
    sku: card.sku,
    name: card.name,
    unit: card.unit,
    imageKey: card.imageKey,
    unitGross: card.price.unitGross,
    regularGross: card.price.regularGross,
    vatBps: card.vatBps,
    priceKind: card.price.kind,
    availability: { status: card.availability.status, label: card.availability.label },
  };
}

function materialLookup(catalog: Catalog, viewer: Viewer): MaterialLookup {
  return (sku) => {
    const p = catalog.bySku.get(sku);
    if (!p) return undefined;
    return {
      sku,
      name: p.name,
      unitGross: priceForCustomer(p, viewer.pricing, viewer.now).unitGross,
      available: availabilityFor(p, catalog, viewer.area).status !== "out_of_stock",
      attributes: p.attributes,
    };
  };
}

async function llmCallsToday(): Promise<number> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const [row] = await db
    .select({ n: count() })
    .from(aiUsage)
    .where(and(ne(aiUsage.provider, "rules"), gte(aiUsage.createdAt, since)));
  return row.n;
}

/** Messages the rules couldn't place that read like a sentence rather than a product name. */
function worthAskingModel(message: string): boolean {
  return message.trim().split(/\s+/).length >= 4;
}

export async function runAssistantTurn(message: string, rawState: unknown, viewer: Viewer): Promise<AssistantTurn> {
  const text = message.trim().slice(0, MAX_MESSAGE_LENGTH);
  const parsedState = StateSchema.safeParse(rawState);
  const state = (parsedState.success ? parsedState.data : INITIAL_STATE) as AssistantState;
  const [catalog, settings] = await Promise.all([loadCatalog(), getSettings()]);

  const limit = await hitRateLimit(`assistant:${viewer.visitorId}`, settings.ai.visitorHourlyLimit, 3600);
  if (!limit.ok) {
    return {
      reply: {
        text: `You've sent a lot of messages in the last hour, so I'm taking a short break. Try again in about ${Math.ceil(limit.retryAfterSeconds / 60)} minutes — or browse the catalogue in the meantime.`,
        quickReplies: [],
        estimate: null,
        productQuery: null,
        action: null,
        intent: "help",
      },
      state,
      products: [],
      limited: true,
    };
  }

  const started = Date.now();
  let provider: "rules" | "openai" | "anthropic" | "gemini" = "rules";
  let model: string | null = null;
  let inputTokens = 0;
  let outputTokens = 0;
  let success = true;
  let interpretation = interpretWithRules(text, state);
  const config = llmConfig();
  if (
    interpretation.intent === "search" &&
    config &&
    settings.ai.llmEnabled &&
    worthAskingModel(text) &&
    (await llmCallsToday()) < settings.ai.dailyLlmLimit
  ) {
    const result = await interpretWithLlm(text, state);
    provider = config.provider;
    model = config.model;
    inputTokens = result.inputTokens;
    outputTokens = result.outputTokens;
    success = !result.error;
    if (result.interpretation) interpretation = result.interpretation;
  }

  const { state: nextState, reply } = respond(state, text, { lookup: materialLookup(catalog, viewer), interpretation });

  let products: ProductSummary[] = [];
  if (reply.productQuery) {
    const ranked = await rankProducts(reply.productQuery, 6);
    products = ranked.map((r) => catalog.byId.get(r.id)).filter((p) => !!p).map((p) => summary(p!, catalog, viewer));
    await db.insert(searchLogs).values({
      query: reply.productQuery.slice(0, 200),
      resultsCount: ranked.length,
      source: "assistant",
      detectedJob: detectJobInQuery(reply.productQuery),
      userId: viewer.user?.id ?? null,
    });
  }

  const estimate: EstimateView | null = reply.estimate
    ? {
        ...reply.estimate,
        lines: reply.estimate.lines.map((l) => {
          const p = catalog.bySku.get(l.sku);
          return { ...l, product: p ? summary(p, catalog, viewer) : null };
        }),
      }
    : null;

  await db.insert(aiUsage).values({
    visitorId: viewer.visitorId,
    userId: viewer.user?.id ?? null,
    feature: "assistant",
    provider,
    model,
    intent: reply.intent,
    inputTokens,
    outputTokens,
    costCentipence: Math.round(
      (inputTokens * settings.ai.inputPencePerMillion + outputTokens * settings.ai.outputPencePerMillion) / 10_000,
    ),
    latencyMs: Date.now() - started,
    success,
    estimateGross: estimate?.totalGross ?? null,
  });

  return {
    reply: { ...reply, estimate, quickReplies: reply.quickReplies.length ? reply.quickReplies : JOB_STARTERS.slice(0, 3) },
    state: nextState,
    products,
    limited: false,
  };
}

/** Records that an assistant estimate led to items going in the basket. */
export async function markEstimateAdded(visitorId: string): Promise<void> {
  const [latest] = await db
    .select({ id: aiUsage.id })
    .from(aiUsage)
    .where(and(eq(aiUsage.visitorId, visitorId), isNotNull(aiUsage.estimateGross)))
    .orderBy(desc(aiUsage.createdAt))
    .limit(1);
  if (latest) await db.update(aiUsage).set({ addedToBasket: true }).where(eq(aiUsage.id, latest.id));
}
