import "server-only";
import { z } from "zod";
import type { AssistantState, Interpretation } from "@/lib/domain/assistant/engine";
import type { JobType } from "@/lib/domain/estimator/types";

export const JOB_TYPES = [
  "plasterboard",
  "skim",
  "paint",
  "tile",
  "stud-wall",
  "fence",
  "concrete-base",
  "patio",
  "flooring",
  "loft-insulation",
] as const satisfies readonly JobType[];

export type LlmProvider = "openai" | "anthropic" | "gemini";

const DEFAULT_MODELS: Record<LlmProvider, string> = {
  gemini: "gemini-3.8-flash",
  openai: "gpt-4.1-mini",
  anthropic: "claude-sonnet-4-5",
};

export function llmConfig(): { provider: LlmProvider; model: string; apiKey: string } | null {
  const geminiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  const requested = process.env.AI_PROVIDER?.trim().toLowerCase();
  const provider: LlmProvider | null =
    requested === "gemini" || requested === "google"
      ? "gemini"
      : requested === "openai"
        ? "openai"
        : requested === "anthropic"
          ? "anthropic"
          : geminiKey
            ? "gemini"
            : process.env.OPENAI_API_KEY
              ? "openai"
              : process.env.ANTHROPIC_API_KEY
                ? "anthropic"
                : null;
  if (!provider) return null;
  const apiKey =
    provider === "gemini" ? geminiKey : provider === "openai" ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return { provider, model: process.env.AI_MODEL?.trim() || DEFAULT_MODELS[provider], apiKey };
}

export function llmConfigured(): boolean {
  return llmConfig() !== null;
}

const SYSTEM_PROMPT = `You read messages sent to a UK building-materials shop's assistant and return JSON only. You never calculate quantities or prices.

Job types: ${JOB_TYPES.join(", ")}.

Return exactly: {"intent": <job type> | "search" | "none", "inputs": {...}, "options": {...}, "searchQuery": string | null}

"inputs" holds only measurements stated in THIS message, converted to metres (depthMm stays in millimetres):
lengthM, widthM, heightM, areaM2, depthMm, runLengthM (fences), doors, windows.

"options" holds only preferences stated in THIS message:
surface ("wall"|"ceiling"|"floor"), boardType ("standard"|"moisture"|"fire"|"acoustic"), coats (number), includeCeiling (boolean), newPlaster (boolean), colour ("white"|"magnolia"), tileSize ("300x600"|"100x200"|"600x600"), layout ("straight"|"diagonal"), wastePct (number), studSize (63|89), insulation (boolean), panelHeight ("6ft"|"5ft"), gravelBoards (boolean), existingInsulationMm (number), subBase (boolean).

If the message adds detail to the current job, use the current job's type. If the customer wants a product rather than help with a job, use intent "search" with a short searchQuery naming the product. Use "none" for anything unrelated to building materials.`;

const num = z.number().positive().max(10000);
const OutputSchema = z.object({
  intent: z.enum([...JOB_TYPES, "search", "none"]),
  inputs: z
    .object({
      lengthM: num,
      widthM: num,
      heightM: num,
      areaM2: num,
      depthMm: num,
      runLengthM: num,
      doors: z.number().int().min(0).max(50),
      windows: z.number().int().min(0).max(50),
    })
    .partial()
    .default({}),
  options: z
    .object({
      surface: z.enum(["wall", "ceiling", "floor"]),
      boardType: z.enum(["standard", "moisture", "fire", "acoustic"]),
      coats: z.number().int().min(1).max(5),
      includeCeiling: z.boolean(),
      newPlaster: z.boolean(),
      colour: z.enum(["white", "magnolia"]),
      tileSize: z.enum(["300x600", "100x200", "600x600"]),
      layout: z.enum(["straight", "diagonal"]),
      wastePct: z.number().min(0).max(50),
      studSize: z.union([z.literal(63), z.literal(89)]),
      insulation: z.boolean(),
      panelHeight: z.enum(["6ft", "5ft"]),
      gravelBoards: z.boolean(),
      existingInsulationMm: z.number().min(0).max(400),
      subBase: z.boolean(),
    })
    .partial()
    .default({}),
  searchQuery: z.string().max(120).nullable().default(null),
});

export type LlmResult = {
  interpretation: Interpretation | null;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  error: string | null;
};

function stripNulls(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined));
}

function parseJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("No JSON in model reply");
  const raw = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  return {
    ...raw,
    inputs: stripNulls((raw.inputs as Record<string, unknown>) ?? {}),
    options: stripNulls((raw.options as Record<string, unknown>) ?? {}),
  };
}

/** Asks the configured language model to read the message. Falls back to the built-in rules on any problem. */
export async function interpretWithLlm(message: string, state: AssistantState): Promise<LlmResult> {
  const config = llmConfig();
  const started = Date.now();
  if (!config) return { interpretation: null, inputTokens: 0, outputTokens: 0, latencyMs: 0, error: "not configured" };
  const userContent = `Current job: ${state.job ? JSON.stringify(state.job) : "none"}\nWaiting for: ${state.awaiting ?? "nothing"}\nMessage: ${message}`;
  try {
    const { text, inputTokens, outputTokens } = await complete(config, userContent);
    const parsed = OutputSchema.parse(parseJson(text));
    return {
      interpretation: {
        intent: parsed.intent,
        inputs: parsed.inputs,
        merged: false,
        options: parsed.options,
        searchQuery: parsed.searchQuery,
      },
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - started,
      error: null,
    };
  } catch (err) {
    return {
      interpretation: null,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function complete(
  config: { provider: LlmProvider; model: string; apiKey: string },
  userContent: string,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  if (config.provider === "gemini") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": config.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: userContent }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0, maxOutputTokens: 400 },
        }),
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    return {
      text: data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "",
      inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }
  if (config.provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 400,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
      usage?: { prompt_tokens: number; completion_tokens: number };
    };
    return {
      text: data.choices[0]?.message.content ?? "",
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    };
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": config.apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as {
    content: { type: string; text?: string }[];
    usage?: { input_tokens: number; output_tokens: number };
  };
  return {
    text: data.content.find((c) => c.type === "text")?.text ?? "",
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
}

