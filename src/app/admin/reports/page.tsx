import { and, eq, gte, sql } from "drizzle-orm";
import { PageHeader } from "@/components/ui/card";
import { db } from "@/lib/db";
import { aiUsage, orders, searchLogs } from "@/lib/db/schema";
import { formatGBP } from "@/lib/domain/money";
import { blueprintEconomics } from "@/lib/domain/profit";
import { requireStaff } from "@/lib/server/auth";
import { orderEconomics } from "@/lib/server/orders";

export const metadata = { title: "Reports · Admin" };

export default async function AdminReportsPage() {
  await requireStaff("reports.view");
  const since = new Date(Date.now() - 30 * 86400000);
  const paid = await db.query.orders.findMany({
    where: and(eq(orders.paymentStatus, "paid"), gte(orders.createdAt, since)),
    columns: { id: true, totalGross: true },
  });
  const economics = await Promise.all(paid.slice(0, 40).map((o) => orderEconomics(o.id)));
  const contribution = economics.reduce((s, e) => s + (e?.actual.contribution ?? 0), 0);
  const revenue = paid.reduce((s, o) => s + o.totalGross, 0);
  const [searches] = await db.select({ n: sql<number>`count(*)` }).from(searchLogs).where(gte(searchLogs.createdAt, since));
  const [ai] = await db.select({ n: sql<number>`count(*)`, cost: sql<number>`coalesce(sum(${aiUsage.costCentipence}), 0)` }).from(aiUsage).where(gte(aiUsage.createdAt, since));
  const scenarios = blueprintEconomics();

  return (
    <div>
      <PageHeader title="Profit reporting" description="Last 30 days. Actual contribution uses supplier invoices where they exist; otherwise estimated purchase-order costs." />
      <ul className="mt-6 grid gap-3 sm:grid-cols-3">
        <li className="rounded-2xl p-4 ring-1 ring-ink-200">
          <p className="text-xs text-ink-500">Paid revenue</p>
          <p className="text-2xl font-extrabold">{formatGBP(revenue)}</p>
        </li>
        <li className="rounded-2xl p-4 ring-1 ring-ink-200">
          <p className="text-xs text-ink-500">Contribution (sample of orders)</p>
          <p className="text-2xl font-extrabold">{formatGBP(contribution)}</p>
        </li>
        <li className="rounded-2xl p-4 ring-1 ring-ink-200">
          <p className="text-xs text-ink-500">Searches / AI turns</p>
          <p className="text-2xl font-extrabold">
            {Number(searches.n)} / {Number(ai.n)}
          </p>
        </li>
      </ul>
      <h2 className="mt-10 font-bold">Illustrative order from the blueprint</h2>
      <p className="text-sm text-ink-600">£150 customer payment example — not a forecast.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {scenarios.map((s) => (
          <div key={s.title} className="rounded-2xl p-4 ring-1 ring-ink-200">
            <h3 className="font-bold">{s.title}</h3>
            <p className="text-sm text-ink-600">{s.description}</p>
            <dl className="mt-3 space-y-1 text-sm">
              {s.rows.map((r) => (
                <div key={r.label} className="flex justify-between">
                  <dt>{r.label}</dt>
                  <dd>{formatGBP(r.amount)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 font-bold">Contribution {formatGBP(s.contribution)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
