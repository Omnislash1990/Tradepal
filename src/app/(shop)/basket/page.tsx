import { updateQuantityAction, removeItemAction, clearBasketAction } from "@/app/actions/basket";
import { quoteFromBasketAction } from "@/app/actions/account";
import { Container } from "@/components/layout/container";
import { PostcodeChecker } from "@/components/layout/postcode-checker";
import { ProductArt } from "@/components/product/product-art";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { DELIVERY_CLASS_LABEL, formatDeliveryDate } from "@/lib/domain/delivery";
import { formatGBP } from "@/lib/domain/money";
import { getBasketView } from "@/lib/server/basket";
import { getViewer } from "@/lib/server/context";

export const metadata = { title: "Basket" };

export default async function BasketPage() {
  const viewer = await getViewer();
  const basket = await getBasketView(viewer);
  const draft = basket.draft?.ok ? basket.draft.draft : null;

  return (
    <Container className="py-8" width="default">
      <PageHeader title="Basket" description={basket.count ? `${basket.count} items` : "Your basket is empty."} />
      {basket.lines.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="Nothing in the basket yet" action={<ButtonLink href="/products">Browse products</ButtonLink>}>
            Search the catalogue or ask the assistant to build a job list.
          </EmptyState>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <ul className="space-y-4">
            {basket.lines.map((line) => (
              <li key={line.card.id} className="flex gap-4 rounded-2xl bg-white p-4 shadow-card ring-1 ring-ink-200">
                <ProductArt imageKey={line.card.imageKey} categorySlug={line.card.categorySlug} className="size-24 shrink-0" />
                <div className="min-w-0 flex-1">
                  <a href={`/products/${line.card.slug}`} className="font-semibold hover:text-brand-700">
                    {line.card.name}
                  </a>
                  <p className="text-sm text-ink-500">{formatGBP(line.card.price.unitGross)} / {line.card.unit}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <form action={updateQuantityAction} className="flex items-center gap-2">
                      <input type="hidden" name="productId" value={line.card.id} />
                      <label className="sr-only" htmlFor={`qty-${line.card.id}`}>
                        Quantity
                      </label>
                      <input
                        id={`qty-${line.card.id}`}
                        name="quantity"
                        type="number"
                        min={1}
                        max={999}
                        defaultValue={line.quantity}
                        className="h-10 w-16 rounded-lg text-center ring-1 ring-ink-300"
                      />
                      <SubmitButton size="sm" variant="secondary">
                        Update
                      </SubmitButton>
                    </form>
                    <form action={removeItemAction}>
                      <input type="hidden" name="productId" value={line.card.id} />
                      <SubmitButton size="sm" variant="ghost">
                        Remove
                      </SubmitButton>
                    </form>
                  </div>
                </div>
                <p className="font-bold">{formatGBP(line.lineGross)}</p>
              </li>
            ))}
          </ul>
          <aside className="h-fit space-y-4 rounded-2xl bg-white p-5 shadow-card ring-1 ring-ink-200 lg:sticky lg:top-28">
            <h2 className="font-bold">Order summary</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt>Goods</dt>
                <dd className="font-medium">{formatGBP(basket.goodsGross)}</dd>
              </div>
              {basket.savingsGross > 0 && (
                <div className="flex justify-between text-success-700">
                  <dt>Saving</dt>
                  <dd>−{formatGBP(basket.savingsGross)}</dd>
                </div>
              )}
              {draft ? (
                <>
                  <div className="flex justify-between">
                    <dt>Delivery</dt>
                    <dd className="font-medium">{formatGBP(draft.deliveryGross)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-ink-100 pt-2 text-base font-bold">
                    <dt>Total inc VAT</dt>
                    <dd>{formatGBP(draft.totalGross)}</dd>
                  </div>
                  {draft.plan.shipments.length > 1 && (
                    <p className="text-xs text-ink-500">This order will arrive in {draft.plan.shipments.length} deliveries from different suppliers.</p>
                  )}
                  <ul className="space-y-1 text-xs text-ink-600">
                    {draft.plan.shipments.map((s) => (
                      <li key={s.supplierId + s.deliveryClass}>
                        {DELIVERY_CLASS_LABEL[s.deliveryClass]} · {formatDeliveryDate(s.estimatedDate)}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-ink-600">Enter a postcode to see delivery charges and dates.</p>
              )}
            </dl>
            <PostcodeChecker current={viewer.postcode?.formatted} />
            {draft?.unavailable.length ? (
              <p className="text-sm text-danger-700">
                Not available for this postcode: {draft.unavailable.map((l) => l.product.name).join(", ")}
              </p>
            ) : null}
            {draft && draft.unavailable.length === 0 ? (
              <ButtonLink href="/checkout" className="w-full">
                Checkout
              </ButtonLink>
            ) : (
              <Button disabled className="w-full">
                Checkout
              </Button>
            )}
            {viewer.user?.tradeStatus === "approved" && (
              <form action={quoteFromBasketAction}>
                <SubmitButton variant="secondary" className="w-full">
                  Save as quote
                </SubmitButton>
              </form>
            )}
            <form action={clearBasketAction}>
              <SubmitButton variant="ghost" className="w-full">
                Empty basket
              </SubmitButton>
            </form>
          </aside>
        </div>
      )}
    </Container>
  );
}
