import { desc } from "drizzle-orm";
import { PageHeader } from "@/components/ui/card";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { formatGBP } from "@/lib/domain/money";
import { formatDateTime } from "@/lib/format";
import { requireStaff } from "@/lib/server/auth";
import { ORDER_STATUS_LABEL } from "@/lib/server/orders";

export const metadata = { title: "Orders · Admin" };

export default async function AdminOrdersPage() {
  await requireStaff("orders.view");
  const rows = await db.query.orders.findMany({ orderBy: desc(orders.createdAt), limit: 100 });
  return (
    <div>
      <PageHeader title="Orders" />
      <div className="mt-6 overflow-x-auto rounded-2xl ring-1 ring-ink-200">
        <table className="w-full text-sm">
          <thead className="bg-mist text-left text-ink-600">
            <tr>
              <th className="px-4 py-2">Number</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Total</th>
              <th>Placed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} className="border-t border-ink-100">
                <td className="px-4 py-2">
                  <a href={`/admin/orders/${o.number}`} className="font-semibold text-brand-700">
                    {o.number}
                  </a>
                </td>
                <td>{o.name}</td>
                <td>{ORDER_STATUS_LABEL[o.status]}</td>
                <td>{o.paymentStatus}</td>
                <td>{formatGBP(o.totalGross)}</td>
                <td>{formatDateTime(o.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
