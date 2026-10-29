import { eq } from "drizzle-orm";
import { Container } from "@/components/layout/container";
import { ProductArt } from "@/components/product/product-art";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { db } from "@/lib/db";
import { addresses } from "@/lib/db/schema";
import { DELIVERY_CLASS_LABEL, formatDeliveryDate } from "@/lib/domain/delivery";
import { formatGBP } from "@/lib/domain/money";
import { getBasketView } from "@/lib/server/basket";
import { getViewer } from "@/lib/server/context";
import { stripeConfigured } from "@/lib/server/payments";
import { CheckoutForm } from "./checkout-form";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage({ searchParams }: PageProps<"/checkout">) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const basket = await getBasketView(viewer);
  const draft = basket.draft?.ok ? basket.draft.draft : null;
  const saved = viewer.user
    ? await db.query.addresses.findMany({ where: eq(addresses.userId, viewer.user.id) })
    : [];
  const cancelled = typeof sp.cancelled === "string" ? sp.cancelled : null;

  if (basket.lines.length === 0) {
    return (
      <Container className="py-8">
        <EmptyState title="Your basket is empty" action={<ButtonLink href="/products">Shop products</ButtonLink>} />
      </Container>
    );
  }

  if (!draft) {
    return (
      <Container className="py-8">
        <PageHeader title="Checkout" description="Add a delivery postcode on the basket page so we can confirm costs." />
        <ButtonLink href="/basket" className="mt-6">
          Back to basket
        </ButtonLink>
      </Container>
    );
  }

  return (
    <Container className="py-8">
      <PageHeader title="Checkout" description="Review deliveries, pay securely, then we'll send your order to suppliers." />
      {cancelled && <p className="mt-4 rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-800">Payment for {cancelled} was cancelled. You can try again.</p>}
      {draft.plan.shipments.length > 1 && (
        <p className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900">
          This order will arrive in {draft.plan.shipments.length} separate deliveries.
        </p>
      )}
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <CheckoutForm
          email={viewer.user?.email ?? ""}
          name={viewer.user?.name ?? ""}
          isTrade={viewer.user?.tradeStatus === "approved"}
          signedIn={!!viewer.user}
          saved={saved}
          defaultPostcode={draft.postcode.formatted}
          stripe={stripeConfigured()}
        />
        <aside className="h-fit rounded-2xl bg-white p-5 shadow-card ring-1 ring-ink-200">
          <h2 className="font-bold">Your order</h2>
          <ul className="mt-3 space-y-3">
            {basket.lines.map((l) => (
              <li key={l.card.id} className="flex gap-3 text-sm">
                <ProductArt imageKey={l.card.imageKey} categorySlug={l.card.categorySlug} name={l.card.name} className="size-12 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium">{l.card.name}</p>
                  <p className="text-ink-500">
                    {l.quantity} × {formatGBP(l.card.price.unitGross)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 border-t border-ink-100 pt-3 text-sm">
            <div className="flex justify-between">
              <dt>Goods</dt>
              <dd>{formatGBP(draft.goodsGross)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Delivery</dt>
              <dd>{formatGBP(draft.deliveryGross)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>VAT included</dt>
              <dd>{formatGBP(draft.vat.vat)}</dd>
            </div>
            <div className="flex justify-between text-base font-bold">
              <dt>Total</dt>
              <dd>{formatGBP(draft.totalGross)}</dd>
            </div>
          </dl>
          <ul className="mt-4 space-y-2 text-xs text-ink-600">
            {draft.plan.shipments.map((s) => (
              <li key={s.supplierId + s.deliveryClass}>
                {DELIVERY_CLASS_LABEL[s.deliveryClass]} estimated {formatDeliveryDate(s.estimatedDate)}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </Container>
  );
}
