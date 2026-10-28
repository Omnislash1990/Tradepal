import { importSupplierCsvAction } from "@/app/actions/admin";
import { AdminForm } from "../admin-form";
import { PageHeader } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { db } from "@/lib/db";
import { feedImports, suppliers } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { requireStaff } from "@/lib/server/auth";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Suppliers · Admin" };

export default async function AdminSuppliersPage() {
  await requireStaff("suppliers.edit");
  const [rows, feeds] = await Promise.all([
    db.select().from(suppliers),
    db.query.feedImports.findMany({ orderBy: desc(feedImports.createdAt), limit: 10 }),
  ]);
  return (
    <div>
      <PageHeader title="Suppliers" description="Sample merchants until live agreements are in place. Do not scrape public websites." />
      <ul className="mt-6 space-y-3">
        {rows.map((s) => (
          <li key={s.id} className="rounded-2xl p-4 ring-1 ring-ink-200">
            <p className="font-bold">
              {s.name} <span className="font-normal text-ink-500">({s.code})</span>
            </p>
            <p className="text-sm text-ink-600">
              {s.integration} · lead {s.leadTimeDays}d · cutoff {s.cutoffHour}:00 · {s.isSample ? "sample" : "live"}
            </p>
            <p className="text-xs text-ink-500">{s.notes}</p>
          </li>
        ))}
      </ul>
      <h2 className="mt-10 font-bold">Import CSV</h2>
      <p className="text-sm text-ink-600">Columns: sku, cost_net (pounds), stock_status, stock_qty</p>
      <AdminForm action={importSupplierCsvAction} className="mt-4 max-w-xl space-y-3">
        <Field label="Supplier" name="supplierId">
          <Select name="supplierId">
            {rows.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="CSV" name="csv">
          <Textarea name="csv" rows={8} placeholder="sku,cost_net,stock_status,stock_qty" />
        </Field>
        <SubmitButton>Import and reprice</SubmitButton>
      </AdminForm>
      <h2 className="mt-10 font-bold">Recent feeds</h2>
      <ul className="mt-3 text-sm">
        {feeds.map((f) => (
          <li key={f.id}>
            {formatDateTime(f.createdAt)} · {f.filename ?? f.source} · {f.updated} updated, {f.created} created
            {f.errors.length ? ` · ${f.errors.length} errors` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
