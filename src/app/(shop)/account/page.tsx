import { desc, eq } from "drizzle-orm";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { ProfileForm } from "./profile-form";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { formatGBP } from "@/lib/domain/money";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/lib/server/auth";
import { ORDER_STATUS_LABEL } from "@/lib/server/orders";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser("/account");
  const recent = await db.query.orders.findMany({
    where: eq(orders.userId, user.id),
    orderBy: desc(orders.createdAt),
    limit: 5,
  });

  return (
    <div>
      <PageHeader title={`Hello, ${user.name.split(" ")[0]}`} description={user.email} />
      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href="/account/orders" variant="secondary">
          Orders
        </ButtonLink>
        <ButtonLink href="/account/lists" variant="secondary">
          Lists
        </ButtonLink>
        {user.tradeStatus !== "approved" && (
          <ButtonLink href="/trade" variant="primary">
            Trade account
          </ButtonLink>
        )}
      </div>
      <section className="mt-10">
        <h2 className="font-bold">Recent orders</h2>
        {recent.length === 0 ? (
          <p className="mt-2 text-sm text-ink-600">You haven&apos;t ordered yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink-100 rounded-2xl ring-1 ring-ink-200">
            {recent.map((o) => (
              <li key={o.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <a href={`/account/orders/${o.number}`} className="font-semibold hover:text-brand-700">
                  {o.number}
                </a>
                <span className="text-ink-500">{formatDate(o.createdAt)}</span>
                <span>{ORDER_STATUS_LABEL[o.status]}</span>
                <span className="font-medium">{formatGBP(o.totalGross)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="mt-10">
        <h2 className="font-bold">Your details</h2>
        <ProfileForm user={user} />
      </section>
    </div>
  );
}
