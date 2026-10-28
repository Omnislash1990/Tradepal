import "server-only";
import { lt, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSeconds: number };

/** Fixed-window counter stored in the database, so limits hold across server instances. */
export async function hitRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const windowStart = nowSeconds - (nowSeconds % windowSeconds);
  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({ target: [rateLimits.key, rateLimits.windowStart], set: { count: sql`${rateLimits.count} + 1` } })
    .returning({ count: rateLimits.count });
  if (row.count === 1 && windowStart % 3600 === 0) {
    await db.delete(rateLimits).where(lt(rateLimits.windowStart, nowSeconds - 2 * 86400));
  }
  return {
    ok: row.count <= limit,
    remaining: Math.max(0, limit - row.count),
    retryAfterSeconds: windowStart + windowSeconds - nowSeconds,
  };
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}
