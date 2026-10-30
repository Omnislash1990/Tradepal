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
  try {
    const [row] = await db
      .insert(rateLimits)
      .values({ key, windowStart, count: 1 })
      .onConflictDoUpdate({ target: [rateLimits.key, rateLimits.windowStart], set: { count: sql`${rateLimits.count} + 1` } })
      .returning({ count: rateLimits.count });
    const used = row?.count ?? 1;
    if (used === 1 && windowStart % 3600 === 0) {
      await db.delete(rateLimits).where(lt(rateLimits.windowStart, nowSeconds - 2 * 86400)).catch(() => undefined);
    }
    return {
      ok: used <= limit,
      remaining: Math.max(0, limit - used),
      retryAfterSeconds: windowStart + windowSeconds - nowSeconds,
    };
  } catch (err) {
    console.error("[rate-limit]", err);
    return { ok: true, remaining: limit, retryAfterSeconds: 0 };
  }
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}
