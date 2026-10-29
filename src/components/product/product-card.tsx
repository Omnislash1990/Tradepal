import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { ProductCardData } from "@/lib/server/catalog";
import { AddToBasket } from "./add-to-basket";
import { AvailabilityBadge } from "./availability-badge";
import { Price } from "./price";
import { ProductArt } from "./product-art";

export function ProductCard({ product, exVat }: { product: ProductCardData; exVat: boolean }) {
  const discountPct =
    product.price.kind === "promo" ? Math.round((product.price.savingGross / product.price.regularGross) * 100) : 0;
  return (
    <article className="group relative flex flex-col rounded-2xl bg-white p-3 shadow-card ring-1 ring-ink-200 transition hover:shadow-lift hover:ring-brand-200">
      <div className="relative">
        <ProductArt imageKey={product.imageKey} categorySlug={product.categorySlug} imageUrl={product.imageUrl} name={product.name} alt={product.name} />
        <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
          {discountPct > 0 && <Badge tone="danger">Save {discountPct}%</Badge>}
          {product.price.kind === "trade" && <Badge tone="brand">Trade price</Badge>}
        </div>
      </div>
      <div className="flex flex-1 flex-col px-1 pt-3">
        <p className="text-xs font-medium text-ink-500">{product.categoryName}</p>
        <h3 className="mt-0.5 line-clamp-2 min-h-11 text-[0.95rem] leading-snug font-semibold">
          <Link href={`/products/${product.slug}`} className="after:absolute after:inset-0 after:rounded-2xl hover:text-brand-700">
            {product.name}
          </Link>
        </h3>
        <AvailabilityBadge status={product.availability.status} label={shortLabel(product.availability.status)} className="mt-2 text-xs" />
        <div className="mt-auto pt-3">
          <Price
            gross={product.price.unitGross}
            vatBps={product.vatBps}
            exVat={exVat}
            regularGross={product.price.regularGross}
            kind={product.price.kind}
            unit={product.unit}
            size="sm"
          />
          <div className="relative z-10 mt-3">
            <AddToBasket compact productId={product.id} productName={product.name} disabled={product.availability.status === "out_of_stock"} />
          </div>
        </div>
      </div>
    </article>
  );
}

function shortLabel(status: ProductCardData["availability"]["status"]): string {
  switch (status) {
    case "in_stock":
      return "In stock · verified";
    case "low_stock":
      return "Low stock · verified";
    case "unverified":
      return "Available to order";
    default:
      return "Out of stock";
  }
}

export function ProductGrid({ products, exVat }: { products: ProductCardData[]; exVat: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} exVat={exVat} />
      ))}
    </div>
  );
}
