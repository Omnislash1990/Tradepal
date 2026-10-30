"use server";

import { cookies } from "next/headers";
import { runAssistantTurn, StateSchema, type AssistantTurn } from "@/lib/server/assistant";
import { getViewer, VISITOR_COOKIE } from "@/lib/server/context";
import { newToken } from "@/lib/ids";

export type AssistantResult = AssistantTurn & { error?: string };

export async function assistantTurnAction(message: string, rawState: unknown): Promise<AssistantResult> {
  const text = message.trim();
  const fallbackState = () => {
    const parsed = StateSchema.safeParse(rawState ?? { job: null, awaiting: null });
    return parsed.success ? parsed.data : { job: null, awaiting: null };
  };
  if (!text) {
    return {
      reply: { text: "Tell me what you're working on, or search for a product.", quickReplies: [], estimate: null, productQuery: null, action: null, intent: "help" },
      state: fallbackState(),
      products: [],
      limited: false,
      error: "empty",
    };
  }
  try {
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
    return await runAssistantTurn(text.slice(0, 500), rawState, viewer);
  } catch (err) {
    console.error("[assistant turn]", err);
    return {
      reply: {
        text: "I couldn't finish that just now. Try describing the job again, or browse the catalogue.",
        quickReplies: [],
        estimate: null,
        productQuery: null,
        action: null,
        intent: "help",
      },
      state: fallbackState(),
      products: [],
      limited: false,
      error: "failed",
    };
  }
}
