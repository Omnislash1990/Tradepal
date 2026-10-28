import { repriceAllAction, savePricingRuleAction } from "@/app/actions/admin";
import { AdminForm } from "../admin-form";
import { PageHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { db } from "@/lib/db";
import { pricingRules } from "@/lib/db/schema";
import { formatBps } from "@/lib/domain/money";
import { requireStaff } from "@/lib/server/auth";

export const metadata = { title: "Pricing · Admin" };

export default async function AdminPricingPage() {
  await requireStaff("pricing.edit");
  const rules = await db.select().from(pricingRules);
  return (
    <div>
      <PageHeader title="Selling price rules" description="Most specific rule wins. After you save, selling prices are recalculated from supplier cost." />
      <form action={repriceAllAction} className="mt-4">
        <SubmitButton variant="secondary">Recalculate all prices</SubmitButton>
      </form>
      <ul className="mt-8 space-y-6">
        {rules.map((r) => (
          <li key={r.id}>
            <AdminForm action={savePricingRuleAction} className="grid max-w-3xl gap-3 rounded-2xl p-4 ring-1 ring-ink-200 sm:grid-cols-4">
              <input type="hidden" name="id" value={r.id} />
              <Field label="Name" name="name" className="sm:col-span-2">
                <Input name="name" defaultValue={r.name} />
              </Field>
              <Field label="Markup %" name="markupPct">
                <Input name="markupPct" defaultValue={String(r.markupBps / 100)} />
              </Field>
              <Field label="Min margin %" name="minMarginPct">
                <Input name="minMarginPct" defaultValue={String(r.minMarginBps / 100)} />
              </Field>
              <Field label="Rounding" name="rounding">
                <Select name="rounding" defaultValue={r.rounding}>
                  <option value="none">Nearest penny</option>
                  <option value="end9">…9p</option>
                  <option value="end49or99">.49 / .99</option>
                </Select>
              </Field>
              <Checkbox name="active" defaultChecked={r.active} label="Active" className="self-end" />
              <p className="self-end text-xs text-ink-500">
                {r.scope} {formatBps(r.markupBps)}
              </p>
              <SubmitButton size="sm" className="self-end">
                Save
              </SubmitButton>
            </AdminForm>
          </li>
        ))}
      </ul>
    </div>
  );
}
