import "server-only";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";

export async function audit(
  actor: { id: string; name: string } | null,
  entry: { action: string; entity: string; entityId?: string | null; summary: string },
): Promise<void> {
  await db.insert(auditLog).values({
    actorId: actor?.id ?? null,
    actorName: actor?.name ?? "system",
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    summary: entry.summary,
  });
}
