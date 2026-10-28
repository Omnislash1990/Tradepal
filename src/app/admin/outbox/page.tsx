import { desc } from "drizzle-orm";
import { PageHeader } from "@/components/ui/card";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";
import { requireStaff } from "@/lib/server/auth";

export const metadata = { title: "Outbox · Admin" };

export default async function OutboxPage() {
  await requireStaff("settings.edit");
  const rows = await db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(80);
  return (
    <div>
      <PageHeader title="Email outbox" description="Without RESEND_API_KEY, messages are stored here instead of being sent." />
      <ul className="mt-6 space-y-3">
        {rows.map((n) => (
          <li key={n.id} className="rounded-2xl p-4 ring-1 ring-ink-200">
            <p className="text-sm font-semibold">
              {n.subject} <span className="font-normal text-ink-500">→ {n.to}</span>
            </p>
            <p className="text-xs text-ink-500">
              {n.status} · {n.template} · {formatDateTime(n.createdAt)}
            </p>
            <pre className="mt-2 max-h-40 overflow-auto text-xs whitespace-pre-wrap text-ink-700">{n.body}</pre>
          </li>
        ))}
      </ul>
    </div>
  );
}
