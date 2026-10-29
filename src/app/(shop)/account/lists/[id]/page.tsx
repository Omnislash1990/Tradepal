import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { addBasketToListAction, addListToBasketAction } from "@/app/actions/account";
import { ProductArt } from "@/components/product/product-art";
import { PageHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { db } from "@/lib/db";
import { lists } from "@/lib/db/schema";
import { loadCatalog, toCard } from "@/lib/server/catalog";
import { getViewer, priceContext } from "@/lib/server/context";
import { requireUser } from "@/lib/server/auth";
import { formatGBP } from "@/lib/domain/money";

export default async function ListDetailPage({ params }: PageProps<"/account/lists/[id]">) {
  const user = await requireUser("/account/lists");
  const { id } = await params;
  const list = await db.query.lists.findFirst({
    where: and(eq(lists.id, id), eq(lists.userId, user.id)),
    with: { items: true },
  });
  if (!list) notFound();
  const [catalog, viewer] = await Promise.all([loadCatalog(), getViewer()]);
  const ctx = priceContext(viewer);

  return (
    <div>
      <PageHeader title={list.name} description={list.notes ?? (list.kind === "job" ? "Job list" : "Saved list")} />
      <div className="mt-4 flex gap-3">
        <form action={addListToBasketAction}>
          <input type="hidden" name="listId" value={list.id} />
          <SubmitButton>Add all to basket</SubmitButton>
        </form>
        <form action={addBasketToListAction}>
          <input type="hidden" name="listId" value={list.id} />
          <SubmitButton variant="secondary">Save current basket into this list</SubmitButton>
        </form>
      </div>
      <ul className="mt-6 space-y-3">
        {list.items.map((item) => {
          const product = catalog.byId.get(item.productId);
          if (!product) return null;
          const card = toCard(product, catalog, ctx);
          return (
            <li key={item.id} className="flex items-center gap-4 rounded-2xl p-3 ring-1 ring-ink-200">
              <ProductArt imageKey={card.imageKey} categorySlug={card.categorySlug} name={card.name} className="size-16" />
              <div className="flex-1">
                <a href={`/products/${card.slug}`} className="font-semibold hover:text-brand-700">
                  {card.name}
                </a>
                <p className="text-sm text-ink-500">
                  {item.quantity} × {formatGBP(card.price.unitGross)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
