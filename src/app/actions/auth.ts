"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { audit } from "@/lib/server/audit";
import { endSession, getCurrentUser, normaliseEmail, safeNext, startSession } from "@/lib/server/auth";
import { mergeGuestBasket } from "@/lib/server/basket";
import { sendEmail } from "@/lib/server/notify";
import { hashPassword, verifyPassword } from "@/lib/server/password";
import { clientIp, hitRateLimit } from "@/lib/server/rate-limit";

export type AuthResult = { ok: boolean; message: string } | null;

const Email = z.email();
const Password = z.string().min(8).max(200);

export async function loginAction(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const email = normaliseEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"), "/account");
  if (!Email.safeParse(email).success) return { ok: false, message: "Enter a valid email address." };
  const limit = await hitRateLimit(`login:${await clientIp()}`, 12, 900);
  if (!limit.ok) return { ok: false, message: "Too many sign-in attempts. Please wait a few minutes." };
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { ok: false, message: "That email or password doesn't match our records." };
  }
  await startSession(user.id);
  await mergeGuestBasket(user.id);
  redirect(next);
}

export async function registerAction(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const email = normaliseEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const marketingOptIn = formData.get("marketing") === "on";
  const next = safeNext(formData.get("next"), "/account");
  if (name.length < 2) return { ok: false, message: "Please enter your name." };
  if (!Email.safeParse(email).success) return { ok: false, message: "Enter a valid email address." };
  if (!Password.safeParse(password).success) return { ok: false, message: "Password must be at least 8 characters." };
  const limit = await hitRateLimit(`register:${await clientIp()}`, 8, 3600);
  if (!limit.ok) return { ok: false, message: "Too many accounts created from this network. Try later." };
  const existing = await db.query.users.findFirst({ where: eq(users.email, email), columns: { id: true } });
  if (existing) return { ok: false, message: "An account with that email already exists. Sign in instead." };
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash: await hashPassword(password), name, marketingOptIn })
    .returning({ id: users.id });
  await sendEmail({
    to: email,
    subject: "Welcome to Tradepal",
    template: "welcome",
    userId: user.id,
    body: `Hi ${name.split(" ")[0]},\n\nYour Tradepal account is ready. You can save addresses, reorder and track deliveries from your account.\n\nThanks for shopping with us.`,
  });
  await startSession(user.id);
  await mergeGuestBasket(user.id);
  redirect(next);
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/");
}

export async function updateProfileAction(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const marketingOptIn = formData.get("marketing") === "on";
  const pricesExVat = formData.get("pricesExVat") === "on";
  if (name.length < 2) return { ok: false, message: "Please enter your name." };
  await db.update(users).set({ name, phone, marketingOptIn, pricesExVat }).where(eq(users.id, user.id));
  return { ok: true, message: "Your details have been updated." };
}

export async function changePasswordAction(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const current = String(formData.get("current") ?? "");
  const nextPassword = String(formData.get("next") ?? "");
  if (!Password.safeParse(nextPassword).success) return { ok: false, message: "New password must be at least 8 characters." };
  const row = await db.query.users.findFirst({ where: eq(users.id, user.id) });
  if (!row || !(await verifyPassword(current, row.passwordHash))) return { ok: false, message: "Current password is incorrect." };
  await db.update(users).set({ passwordHash: await hashPassword(nextPassword) }).where(eq(users.id, user.id));
  await audit(user, { action: "account.password", entity: "user", entityId: user.id, summary: "Changed password" });
  return { ok: true, message: "Password updated." };
}
