import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { PageHeader } from "@/components/ui/card";
import { db } from "@/lib/db";
import { aiUsage, orders, supportTickets, tradeAccounts } from "@/lib/db/schema";
import { formatGBP } from "@/lib/domain/money";
import { requireStaff } from "@/lib/server/auth";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Admin" };

export default async function AdminHome() {
  await requireStaff();
  const since = new Date(Date.now() - 7 * 86400000);
  const [[week], [openTickets], [pendingTrade], recent, [ai]] = await Promise.all([
    db.select({ n: count(), gross: sql<number>`coalesce(sum(${orders.totalGross}), 0)` }).from(orders).where(and(gte(orders.createdAt, since), eq(orders.paymentStatus, "paid"))),
    db.select({ n: count() }).from(supportTickets).where(eq(supportTickets.status, "open")),
    db.select({ n: count() }).from(tradeAccounts).where(eq(tradeAccounts.status, "pending")),
    db.query.orders.findMany({ orderBy: desc(orders.createdAt), limit: 8 }),
    db.select({ n: count() }).from(aiUsage).where(gte(aiUsage.createdAt, since)),
  ]);

  const stats = [
    { label: "Paid orders (7 days)", value: String(week.n) },
    { label: "Revenue (7 days)", value: formatGBP(Number(week.gross)) },
    { label: "Open tickets", value: String(openTickets.n) },
    { label: "Trade applications", value: String(pendingTrade.n) },
    { label: "Assistant turns (7 days)", value: String(ai.n) },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" description="Launch-ready operations view. Sample suppliers only until live feeds are connected." />
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <li key={s.label} className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-ink-200">
            <p className="text-xs font-semibold text-ink-500">{s.label}</p>
            <p className="mt-1 text-2xl font-extrabold">{s.value}</p>
          </li>
        ))}
      </ul>
      <h2 className="mt-10 font-bold">Recent orders</h2>
      <ul className="mt-3 divide-y divide-ink-100 rounded-2xl ring-1 ring-ink-200">
        {recent.map((o) => (
          <li key={o.id}>
            <a href={`/admin/orders/${o.number}`} className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm hover:bg-mist">
              <span className="font-semibold">{o.number}</span>
              <span>{o.name}</span>
              <span>{o.status}</span>
              <span>{formatGBP(o.totalGross)}</span>
              <span className="text-ink-500">{formatDateTime(o.createdAt)}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
