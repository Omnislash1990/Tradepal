import { desc, eq } from "drizzle-orm";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { formatGBP } from "@/lib/domain/money";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/lib/server/auth";
import { ORDER_STATUS_LABEL } from "@/lib/server/orders";

export const metadata = { title: "Orders" };

export default async function OrdersPage() {
  const user = await requireUser("/account/orders");
  const rows = await db.query.orders.findMany({ where: eq(orders.userId, user.id), orderBy: desc(orders.createdAt) });
  return (
    <div>
      <PageHeader title="Orders" />
      {rows.length === 0 ? (
        <EmptyState title="No orders yet" />
      ) : (
        <ul className="mt-6 divide-y divide-ink-100 rounded-2xl ring-1 ring-ink-200">
          {rows.map((o) => (
            <li key={o.id}>
              <a href={`/account/orders/${o.number}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-mist">
                <span className="font-semibold">{o.number}</span>
                <span className="text-sm text-ink-500">{formatDate(o.createdAt)}</span>
                <span className="text-sm">{ORDER_STATUS_LABEL[o.status]}</span>
                <span className="font-medium">{formatGBP(o.totalGross)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
