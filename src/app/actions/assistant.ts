"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { runAssistantTurn, StateSchema, type AssistantTurn } from "@/lib/server/assistant";
import { getViewer, VISITOR_COOKIE } from "@/lib/server/context";
import { newToken } from "@/lib/ids";

export type AssistantResult = AssistantTurn & { error?: string };

export async function assistantTurnAction(message: string, rawState: unknown): Promise<AssistantResult> {
  const text = message.trim();
  if (!text) {
    return {
      reply: { text: "Tell me what you're working on, or search for a product.", quickReplies: [], estimate: null, productQuery: null, action: null, intent: "help" },
      state: StateSchema.parse(rawState ?? { job: null, awaiting: null }),
      products: [],
      limited: false,
      error: "empty",
    };
  }
  const jar = await cookies();
  if (!jar.get(VISITOR_COOKIE)?.value) {
    jar.set(VISITOR_COOKIE, newToken(16), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 365 * 24 * 3600,
    });
  }
  const viewer = await getViewer();
  return runAssistantTurn(text.slice(0, 500), rawState, viewer);
}

export async function parseAssistantState(raw: string): Promise<unknown> {
  try {
    return StateSchema.parse(JSON.parse(raw));
  } catch {
    return { job: null, awaiting: null };
  }
}

export const AssistantPayload = z.object({
  message: z.string().max(500),
  state: z.unknown(),
});
