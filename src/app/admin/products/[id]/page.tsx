import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { saveProductAction } from "@/app/actions/admin";
import { AdminForm } from "../../admin-form";
import { PageHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { formatGBP } from "@/lib/domain/money";
import { requireStaff } from "@/lib/server/auth";

export default async function AdminProductPage({ params }: PageProps<"/admin/products/[id]">) {
  await requireStaff("products.edit");
  const { id } = await params;
  const product = await db.query.products.findFirst({ where: eq(products.id, id), with: { offers: true, category: true } });
  if (!product) notFound();
  return (
    <div>
      <PageHeader title={product.name} description={`${product.sku} · current ${formatGBP(product.retailPriceGross)} inc VAT`} />
      <AdminForm action={saveProductAction} className="mt-6 max-w-xl space-y-4">
        <input type="hidden" name="id" value={product.id} />
        <Field label="Name" name="name">
          <Input name="name" defaultValue={product.name} />
        </Field>
        <Field label="Description" name="description">
          <Textarea name="description" defaultValue={product.description} rows={5} />
        </Field>
        <Field label="Price override £ inc VAT (blank = rule price)" name="priceOverride">
          <Input name="priceOverride" defaultValue={product.priceOverrideGross != null ? (product.priceOverrideGross / 100).toFixed(2) : ""} />
        </Field>
        <Field label="Promo discount %" name="promoBps">
          <Input name="promoBps" defaultValue={product.promoBps != null ? String(product.promoBps / 100) : ""} />
        </Field>
        <Field label="Safety note" name="safetyNote">
          <Input name="safetyNote" defaultValue={product.safetyNote ?? ""} />
        </Field>
        <Checkbox name="active" defaultChecked={product.active} label="Active in catalogue" />
        <SubmitButton>Save</SubmitButton>
      </AdminForm>
      <h2 className="mt-10 font-bold">Supplier offers</h2>
      <ul className="mt-3 text-sm">
        {product.offers.map((o) => (
          <li key={o.id}>
            {o.supplierId}: {formatGBP(o.costNet)} ex VAT · {o.stockStatus}
            {o.verified ? " · verified" : " · unverified"}
          </li>
        ))}
      </ul>
    </div>
  );
}
