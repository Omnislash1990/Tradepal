import "server-only";
import { createHash } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { sessions, tradeAccounts, users, type AccountType, type Role, type TradeStatus } from "@/lib/db/schema";
import { newToken } from "@/lib/ids";

export const SESSION_COOKIE = "tp_session";
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  accountType: AccountType;
  tradeStatus: TradeStatus;
  tradeDiscountBps: number;
  pricesExVat: boolean;
  marketingOptIn: boolean;
  companyName: string | null;
};

/** What each staff role may do in the admin area. Customers have none of these. */
export const PERMISSIONS = {
  "orders.view": ["staff", "admin"],
  "orders.manage": ["staff", "admin"],
  "refunds.issue": ["admin"],
  "products.edit": ["staff", "admin"],
  "pricing.edit": ["admin"],
  "suppliers.edit": ["admin"],
  "support.manage": ["staff", "admin"],
  "customers.view": ["staff", "admin"],
  "trade.approve": ["admin"],
  "reports.view": ["admin"],
  "settings.edit": ["admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(user: Pick<CurrentUser, "role"> | null, permission: Permission): boolean {
  return !!user && (PERMISSIONS[permission] as readonly Role[]).includes(user.role);
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function startSession(userId: string): Promise<void> {
  const token = newToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const userAgent = (await headers()).get("user-agent")?.slice(0, 200) ?? null;
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt, userAgent });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  await db.delete(sessions).where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, new Date())));
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  jar.delete(SESSION_COOKIE);
}

export async function endAllSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ user: users, companyName: tradeAccounts.companyName })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .leftJoin(tradeAccounts, eq(tradeAccounts.userId, users.id))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!row) return null;
  const u = row.user;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone,
    role: u.role,
    accountType: u.accountType,
    tradeStatus: u.tradeStatus,
    tradeDiscountBps: u.tradeDiscountBps,
    pricesExVat: u.pricesExVat,
    marketingOptIn: u.marketingOptIn,
    companyName: row.companyName ?? null,
  };
});

export async function requireUser(next = "/account"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireStaff(permission?: Permission): Promise<CurrentUser> {
  const user = await requireUser("/admin");
  if (user.role === "customer") redirect("/account");
  if (permission && !can(user, permission)) redirect(`/admin?denied=${encodeURIComponent(permission)}`);
  return user;
}

/** Only allow redirects back into this site. */
export function safeNext(next: FormDataEntryValue | string | null | undefined, fallback = "/account"): string {
  const value = typeof next === "string" ? next : "";
  return value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : fallback;
}
