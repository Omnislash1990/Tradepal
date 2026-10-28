import { CatalogFilters } from "@/components/catalog/filters";
import { Container } from "@/components/layout/container";
import { ProductGrid } from "@/components/product/product-card";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { queryProducts, type AvailabilityFilter, type CatalogSort } from "@/lib/server/catalog";
import { getViewer, priceContext } from "@/lib/server/context";

export const metadata = { title: "All products" };

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const sort = (typeof sp.sort === "string" ? sp.sort : "popular") as CatalogSort;
  const availability = (typeof sp.availability === "string" ? sp.availability : "all") as AvailabilityFilter;
  const onOffer = sp.offer === "1";
  const { items, total } = await queryProducts({ sort, availability, onOffer }, priceContext(viewer));

  return (
    <Container className="py-8">
      <PageHeader title="All products" description={`${total} items. Prices ${viewer.exVat ? "exclude" : "include"} VAT.`} />
      <div className="mt-6">
        <CatalogFilters sort={sort} availability={availability} onOffer={onOffer} />
      </div>
      <div className="mt-8">
        {items.length === 0 ? (
          <EmptyState title="No products match those filters">
            Try clearing availability or offers.
          </EmptyState>
        ) : (
          <ProductGrid products={items} exVat={viewer.exVat} />
        )}
      </div>
    </Container>
  );
}
