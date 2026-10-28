import { CatalogFilters } from "@/components/catalog/filters";
import { Container } from "@/components/layout/container";
import { SearchForm } from "@/components/layout/search-form";
import { ProductGrid } from "@/components/product/product-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { db } from "@/lib/db";
import { searchLogs } from "@/lib/db/schema";
import { detectJobInQuery } from "@/lib/domain/search";
import { queryProducts, type AvailabilityFilter, type CatalogSort } from "@/lib/server/catalog";
import { getViewer, priceContext } from "@/lib/server/context";

export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const viewer = await getViewer();
  const sort = (typeof sp.sort === "string" ? sp.sort : "relevance") as CatalogSort;
  const availability = (typeof sp.availability === "string" ? sp.availability : "all") as AvailabilityFilter;
  const { items, total } = q
    ? await queryProducts({ q, sort, availability, onOffer: sp.offer === "1" }, priceContext(viewer))
    : { items: [], total: 0 };
  const job = q ? detectJobInQuery(q) : null;

  if (q) {
    await db.insert(searchLogs).values({
      query: q.slice(0, 200),
      resultsCount: total,
      source: "search",
      detectedJob: job,
      userId: viewer.user?.id ?? null,
    });
  }

  return (
    <Container className="py-8">
      <PageHeader title={q ? `Results for “${q}”` : "Search"} description={q ? `${total} matching products.` : "Find products or describe a job."} />
      <div className="mt-6 max-w-xl">
        <SearchForm defaultValue={q} id="search-page" />
      </div>
      {job && (
        <p className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900">
          That sounds like a {job.replace("-", " ")} job.{" "}
          <ButtonLink href={`/assistant?q=${encodeURIComponent(q)}`} size="sm" className="ml-2 inline-flex h-8">
            Get a materials estimate
          </ButtonLink>
        </p>
      )}
      {q && (
        <div className="mt-6">
          <CatalogFilters sort={sort} availability={availability} onOffer={sp.offer === "1"} action="/search" extra={{ q }} />
        </div>
      )}
      <div className="mt-8">
        {!q ? (
          <EmptyState title="Type a product, SKU or job">Try “plasterboard”, “15mm copper”, or “paint a 4m bedroom”.</EmptyState>
        ) : items.length === 0 ? (
          <EmptyState title="No matches">
            Try a shorter search, or{" "}
            <a href="/assistant" className="font-semibold text-brand-700">
              ask the assistant
            </a>
            .
          </EmptyState>
        ) : (
          <ProductGrid products={items} exVat={viewer.exVat} />
        )}
      </div>
    </Container>
  );
}
