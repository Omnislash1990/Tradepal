import { desc } from "drizzle-orm";
import { PageHeader } from "@/components/ui/card";
import { db } from "@/lib/db";
import { supportTickets } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";
import { requireStaff } from "@/lib/server/auth";

export const metadata = { title: "Support · Admin" };

export default async function AdminSupportPage() {
  await requireStaff("support.manage");
  const tickets = await db.query.supportTickets.findMany({ orderBy: desc(supportTickets.updatedAt), limit: 50 });
  return (
    <div>
      <PageHeader title="Support tickets" />
      <ul className="mt-6 divide-y divide-ink-100 rounded-2xl ring-1 ring-ink-200">
        {tickets.map((t) => (
          <li key={t.id}>
            <a href={`/admin/support/${t.id}`} className="flex flex-wrap justify-between gap-2 px-4 py-3 hover:bg-mist">
              <span className="font-semibold">{t.subject}</span>
              <span className="text-sm text-ink-500">
                {t.number} · {t.status} · {formatDateTime(t.updatedAt)}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
