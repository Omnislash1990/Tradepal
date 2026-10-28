import { desc } from "drizzle-orm";
import { approveTradeAction } from "@/app/actions/admin";
import { AdminForm } from "../admin-form";
import { PageHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { db } from "@/lib/db";
import { tradeAccounts, users } from "@/lib/db/schema";
import { requireStaff } from "@/lib/server/auth";

export const metadata = { title: "Customers · Admin" };

export default async function AdminCustomersPage() {
  await requireStaff("customers.view");
  const [accounts, people] = await Promise.all([
    db.query.tradeAccounts.findMany({ with: { user: true } }),
    db.select({ id: users.id, email: users.email, name: users.name, role: users.role, tradeStatus: users.tradeStatus }).from(users).orderBy(desc(users.createdAt)).limit(50),
  ]);
  const pending = accounts.filter((a) => a.status === "pending");
  return (
    <div>
      <PageHeader title="Customers" />
      <h2 className="mt-6 font-bold">Trade applications</h2>
      {pending.length === 0 && <p className="mt-2 text-sm text-ink-600">None waiting.</p>}
      <ul className="mt-3 space-y-4">
        {pending.map((a) => (
          <li key={a.id} className="rounded-2xl p-4 ring-1 ring-ink-200">
            <p className="font-semibold">
              {a.companyName} · {a.user.email}
            </p>
            <p className="text-sm text-ink-600">
              {a.tradeType} · {a.monthlySpend}
            </p>
            <AdminForm action={approveTradeAction} className="mt-3 flex flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={a.id} />
              <Field label="Discount %" name="discountPct">
                <Input name="discountPct" defaultValue="10" className="w-24" />
              </Field>
              <SubmitButton size="sm">Approve</SubmitButton>
              <SubmitButton size="sm" variant="ghost" name="decision" value="reject">
                Reject
              </SubmitButton>
            </AdminForm>
          </li>
        ))}
      </ul>
      <h2 className="mt-10 font-bold">Recent accounts</h2>
      <ul className="mt-3 text-sm">
        {people.map((u) => (
          <li key={u.id}>
            {u.name} · {u.email} · {u.role} · trade {u.tradeStatus}
          </li>
        ))}
      </ul>
    </div>
  );
}
