import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";

export type EmailTemplate =
  | "order_confirmation"
  | "order_dispatched"
  | "order_delivered"
  | "refund_issued"
  | "substitution"
  | "order_update"
  | "trade_application"
  | "trade_approved"
  | "ticket_reply"
  | "supplier_po"
  | "waitlist_joined"
  | "welcome";

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

/**
 * Records an email in the outbox and sends it through Resend when configured. Without a provider
 * the message is stored as "logged" so it can be read in the admin outbox.
 */
export async function sendEmail(input: {
  to: string;
  subject: string;
  body: string;
  template: EmailTemplate;
  orderId?: string | null;
  userId?: string | null;
}): Promise<void> {
  const [row] = await db
    .insert(notifications)
    .values({
      to: input.to,
      subject: input.subject,
      body: input.body,
      template: input.template,
      orderId: input.orderId ?? null,
      userId: input.userId ?? null,
      status: emailConfigured() ? "queued" : "logged",
      provider: emailConfigured() ? "resend" : null,
    })
    .returning({ id: notifications.id });

  if (!emailConfigured()) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [input.to], subject: input.subject, text: input.body }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    await db
      .update(notifications)
      .set(
        res.ok
          ? { status: "sent", providerId: data.id ?? null, sentAt: new Date() }
          : { status: "failed", error: data.message ?? `HTTP ${res.status}` },
      )
      .where(eq(notifications.id, row.id));
  } catch (err) {
    await db
      .update(notifications)
      .set({ status: "failed", error: err instanceof Error ? err.message : String(err) })
      .where(eq(notifications.id, row.id));
  }
}

export function appUrl(path = ""): string {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}
