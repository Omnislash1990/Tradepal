import { notFound } from "next/navigation";
import { AddToBasket } from "@/components/product/add-to-basket";
import { AvailabilityBadge } from "@/components/product/availability-badge";
import { Price } from "@/components/product/price";
import { ProductArt } from "@/components/product/product-art";
import { ProductGrid } from "@/components/product/product-card";
import { Container } from "@/components/layout/container";
import { PostcodeChecker } from "@/components/layout/postcode-checker";
import { Badge } from "@/components/ui/badge";
import { DELIVERY_CLASS_HINT, DELIVERY_CLASS_LABEL, formatDeliveryDate } from "@/lib/domain/delivery";
import { formatGBP } from "@/lib/domain/money";
import { alternativesFor, availabilityFor, compatibleFor, loadCatalog, toCard } from "@/lib/server/catalog";
import { getViewer, priceContext } from "@/lib/server/context";
import { resolveZone } from "@/lib/server/orders";

export async function generateMetadata({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const catalog = await loadCatalog();
  const product = catalog.bySlug.get(slug);
  return { title: product?.name ?? "Product" };
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const [catalog, viewer] = await Promise.all([loadCatalog(), getViewer()]);
  const product = catalog.bySlug.get(slug);
  if (!product) notFound();
  const ctx = priceContext(viewer);
  const card = toCard(product, catalog, ctx);
  const availability = availabilityFor(product, catalog, viewer.area);
  const alts = alternativesFor(product, catalog, ctx);
  const compatible = compatibleFor(product, catalog, ctx);
  const zone = viewer.postcode ? await resolveZone(viewer.postcode.formatted) : null;
  const lead = availability.fastestLeadDays;

  return (
    <Container className="py-8">
      <nav className="text-sm text-ink-500">
        <a href="/products" className="hover:text-ink-800">
          Products
        </a>
        <span aria-hidden> / </span>
        <a href={`/c/${product.category.slug}`} className="hover:text-ink-800">
          {product.category.name}
        </a>
      </nav>
      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div>
          <ProductArt imageKey={product.imageKey} categorySlug={product.category.slug} imageUrl={product.imageUrl} name={product.name} alt={product.name} className="w-full max-w-lg" />
          <div className="prose mt-8 max-w-none">
            <h2 className="text-lg font-bold">Description</h2>
            <p className="mt-2 whitespace-pre-wrap text-ink-700">{product.description}</p>
          </div>
          {Object.keys(product.specs).length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-bold">Specifications</h2>
              <dl className="mt-3 divide-y divide-ink-100 rounded-2xl ring-1 ring-ink-200">
                {Object.entries(product.specs).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-2 gap-4 px-4 py-3 text-sm">
                    <dt className="text-ink-500">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
        <aside className="h-fit rounded-2xl bg-white p-5 shadow-card ring-1 ring-ink-200 lg:sticky lg:top-28">
          <p className="text-sm font-medium text-ink-500">{product.category.name}</p>
          <h1 className="mt-1 text-2xl font-extrabold">{product.name}</h1>
          <p className="mt-1 text-sm text-ink-500">
            Product code <span className="font-mono">{product.sku}</span>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {card.price.kind === "promo" && <Badge tone="danger">Offer</Badge>}
            {card.price.kind === "trade" && <Badge tone="brand">Trade price</Badge>}
            {product.promoEndsAt && card.price.kind === "promo" && (
              <Badge tone="warning">Ends {product.promoEndsAt.toLocaleDateString("en-GB")}</Badge>
            )}
          </div>
          <div className="mt-5">
            <Price
              gross={card.price.unitGross}
              vatBps={product.vatBps}
              exVat={viewer.exVat}
              regularGross={card.price.regularGross}
              kind={card.price.kind}
              unit={product.unit}
              size="lg"
            />
          </div>
          <div className="mt-4">
            <AvailabilityBadge status={availability.status} label={availability.label} />
          </div>
          <p className="mt-3 text-sm text-ink-600">
            {DELIVERY_CLASS_LABEL[product.deliveryClass]}. {DELIVERY_CLASS_HINT[product.deliveryClass]}
            {lead != null && zone?.ok && (
              <> Estimated from {formatDeliveryDate(new Date(viewer.now.getTime() + lead * 86400000).toISOString().slice(0, 10))}.</>
            )}
          </p>
          <div className="mt-6">
            <AddToBasket productId={product.id} productName={product.name} disabled={availability.status === "out_of_stock"} />
          </div>
          {product.safetyNote && <p className="mt-4 rounded-xl bg-warning-50 p-3 text-sm text-warning-800">{product.safetyNote}</p>}
          <div className="mt-6 border-t border-ink-100 pt-4">
            <p className="text-sm font-semibold">Delivery to your postcode</p>
            <PostcodeChecker current={viewer.postcode?.formatted} className="mt-2" />
          </div>
        </aside>
      </div>

      {alts.length > 0 && (
        <section className="mt-14">
          <h2 className="text-xl font-extrabold">{availability.status === "out_of_stock" ? "Available alternatives" : "Similar products"}</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {alts.map((a) => (
              <li key={a.card.id} className="flex gap-4 rounded-2xl bg-white p-3 ring-1 ring-ink-200">
                <ProductArt imageKey={a.card.imageKey} categorySlug={a.card.categorySlug} name={a.card.name} className="size-20 shrink-0" />
                <div>
                  <a href={`/products/${a.card.slug}`} className="font-semibold hover:text-brand-700">
                    {a.card.name}
                  </a>
                  <p className="text-sm text-ink-600">{formatGBP(a.card.price.unitGross)} inc VAT</p>
                  <p className="mt-1 text-xs text-ink-500">{a.differences.join(" · ")}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {compatible.length > 0 && (
        <section className="mt-14">
          <h2 className="text-xl font-extrabold">Often bought with this</h2>
          <div className="mt-4">
            <ProductGrid products={compatible} exVat={viewer.exVat} />
          </div>
        </section>
      )}
    </Container>
  );
}
