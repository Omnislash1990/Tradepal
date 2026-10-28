"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { supportTickets, ticketMessages } from "@/lib/db/schema";
import { newReference } from "@/lib/ids";
import { getCurrentUser } from "@/lib/server/auth";
import { sendEmail } from "@/lib/server/notify";
import { clientIp, hitRateLimit } from "@/lib/server/rate-limit";

export type SupportResult = { ok: boolean; message: string } | null;

export async function createTicketAction(_prev: SupportResult, formData: FormData): Promise<SupportResult> {
  const user = await getCurrentUser();
  const name = String(formData.get("name") ?? user?.name ?? "").trim();
  const email = String(formData.get("email") ?? user?.email ?? "").trim().toLowerCase();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const topic = (String(formData.get("topic") ?? "other") || "other") as
    | "order"
    | "delivery"
    | "product"
    | "return"
    | "account"
    | "trade"
    | "other";
  if (!name || !z.email().safeParse(email).success) return { ok: false, message: "Name and a valid email are required." };
  if (subject.length < 3 || body.length < 8) return { ok: false, message: "Please describe what you need help with." };
  const limit = await hitRateLimit(`ticket:${await clientIp()}`, 8, 3600);
  if (!limit.ok) return { ok: false, message: "Too many messages. Please wait before sending another." };
  const [ticket] = await db
    .insert(supportTickets)
    .values({
      number: newReference("SUP", 5),
      userId: user?.id ?? null,
      email,
      name,
      orderId: String(formData.get("orderId") ?? "") || null,
      subject,
      topic,
    })
    .returning({ id: supportTickets.id, number: supportTickets.number });
  await db.insert(ticketMessages).values({ ticketId: ticket.id, author: "customer", authorName: name, body });
  if (user) redirect(`/account/support/${ticket.id}`);
  return { ok: true, message: `Thanks — we've logged ${ticket.number}. We'll reply by email.` };
}

export async function replyTicketAction(_prev: SupportResult, formData: FormData): Promise<SupportResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const ticketId = String(formData.get("ticketId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { ok: false, message: "Write a reply first." };
  const ticket = await db.query.supportTickets.findFirst({ where: eq(supportTickets.id, ticketId) });
  if (!ticket || ticket.userId !== user.id) return { ok: false, message: "Ticket not found." };
  await db.insert(ticketMessages).values({ ticketId, author: "customer", authorName: user.name, body });
  await db.update(supportTickets).set({ status: "open", updatedAt: new Date() }).where(eq(supportTickets.id, ticketId));
  return { ok: true, message: "Reply sent." };
}
