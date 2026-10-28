import { Container } from "@/components/layout/container";
import { ProductGrid } from "@/components/product/product-card";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { queryProducts } from "@/lib/server/catalog";
import { getViewer, priceContext } from "@/lib/server/context";

export const metadata = { title: "Offers" };

export default async function OffersPage() {
  const viewer = await getViewer();
  const { items } = await queryProducts({ onOffer: true, sort: "popular" }, priceContext(viewer));
  return (
    <Container className="py-8">
      <PageHeader title="Offers" description="Time-limited prices. Always check the date on the product page." />
      <div className="mt-8">
        {items.length === 0 ? <EmptyState title="No offers on at the moment" /> : <ProductGrid products={items} exVat={viewer.exVat} />}
      </div>
    </Container>
  );
}
