import { asc } from "drizzle-orm";
import { PageHeader } from "@/components/ui/card";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { formatGBP } from "@/lib/domain/money";
import { requireStaff } from "@/lib/server/auth";

export const metadata = { title: "Products · Admin" };

export default async function AdminProductsPage() {
  await requireStaff("products.edit");
  const rows = await db.query.products.findMany({ with: { category: true }, orderBy: asc(products.name) });
  return (
    <div>
      <PageHeader title="Products" />
      <div className="mt-6 overflow-x-auto rounded-2xl ring-1 ring-ink-200">
        <table className="w-full text-sm">
          <thead className="bg-mist text-left">
            <tr>
              <th className="px-4 py-2">SKU</th>
              <th>Name</th>
              <th>Category</th>
              <th>Price inc VAT</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-ink-100">
                <td className="px-4 py-2 font-mono text-xs">{p.sku}</td>
                <td>
                  <a href={`/admin/products/${p.id}`} className="font-semibold text-brand-700">
                    {p.name}
                  </a>
                </td>
                <td>{p.category.name}</td>
                <td>{formatGBP(p.retailPriceGross)}</td>
                <td>{p.active ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
