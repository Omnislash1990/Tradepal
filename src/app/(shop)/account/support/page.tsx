import { eq } from "drizzle-orm";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { db } from "@/lib/db";
import { supportTickets } from "@/lib/db/schema";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/lib/server/auth";

export const metadata = { title: "Support" };

export default async function AccountSupportPage() {
  const user = await requireUser("/account/support");
  const tickets = await db.query.supportTickets.findMany({ where: eq(supportTickets.userId, user.id) });
  return (
    <div>
      <PageHeader title="Support" description="Your conversations with Tradepal." />
      <a href="/contact" className="mt-4 inline-block text-sm font-semibold text-brand-700">
        New message
      </a>
      {tickets.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No tickets yet" />
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-ink-100 rounded-2xl ring-1 ring-ink-200">
          {tickets.map((t) => (
            <li key={t.id}>
              <a href={`/account/support/${t.id}`} className="flex justify-between px-4 py-3 hover:bg-mist">
                <span className="font-semibold">{t.subject}</span>
                <span className="text-sm text-ink-500">
                  {t.status} · {formatDate(t.createdAt)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
