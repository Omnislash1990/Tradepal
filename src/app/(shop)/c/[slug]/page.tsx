import { notFound } from "next/navigation";
import { CatalogFilters } from "@/components/catalog/filters";
import { Container } from "@/components/layout/container";
import { ProductGrid } from "@/components/product/product-card";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { CATEGORIES } from "@/lib/catalog/categories";
import { queryProducts, type AvailabilityFilter, type CatalogSort } from "@/lib/server/catalog";
import { getViewer, priceContext } from "@/lib/server/context";

export async function generateMetadata({ params }: PageProps<"/c/[slug]">) {
  const { slug } = await params;
  const category = CATEGORIES.find((c) => c.slug === slug);
  return { title: category?.name ?? "Category" };
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/c/[slug]">) {
  const { slug } = await params;
  const category = CATEGORIES.find((c) => c.slug === slug);
  if (!category) notFound();
  const sp = await searchParams;
  const viewer = await getViewer();
  const sort = (typeof sp.sort === "string" ? sp.sort : "popular") as CatalogSort;
  const availability = (typeof sp.availability === "string" ? sp.availability : "all") as AvailabilityFilter;
  const onOffer = sp.offer === "1";
  const { items, total } = await queryProducts({ categorySlug: slug, sort, availability, onOffer }, priceContext(viewer));

  return (
    <Container className="py-8">
      <PageHeader eyebrow="Category" title={category.name} description={`${category.description} ${total} products.`} />
      <div className="mt-6">
        <CatalogFilters sort={sort} availability={availability} onOffer={onOffer} action={`/c/${slug}`} />
      </div>
      <div className="mt-8">
        {items.length === 0 ? (
          <EmptyState title="Nothing in this category yet" />
        ) : (
          <ProductGrid products={items} exVat={viewer.exVat} />
        )}
      </div>
    </Container>
  );
}
