import { eq } from "drizzle-orm";
import { addQuoteToBasketAction, quoteFromBasketAction } from "@/app/actions/account";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { db } from "@/lib/db";
import { quotes } from "@/lib/db/schema";
import { formatGBP } from "@/lib/domain/money";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/lib/server/auth";

export const metadata = { title: "Quotes" };

export default async function QuotesPage() {
  const user = await requireUser("/account/quotes");
  const rows = await db.query.quotes.findMany({ where: eq(quotes.userId, user.id) });
  return (
    <div>
      <PageHeader title="Quotes" description="Trade quotes you can download or send to the basket." />
      {user.tradeStatus !== "approved" && <p className="mt-4 text-sm text-ink-600">Quotes are available once a trade account is approved.</p>}
      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No quotes yet" />
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((q) => (
            <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 ring-1 ring-ink-200">
              <div>
                <a href={`/account/quotes/${q.id}`} className="font-semibold hover:text-brand-700">
                  {q.number}
                </a>
                <p className="text-sm text-ink-500">
                  {q.reference} · valid until {formatDate(q.validUntil)} · {formatGBP(q.goodsGross + q.deliveryGross)}
                </p>
              </div>
              <form action={addQuoteToBasketAction}>
                <input type="hidden" name="id" value={q.id} />
                <SubmitButton size="sm">Add to basket</SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}
      {user.tradeStatus === "approved" && (
        <form action={quoteFromBasketAction} className="mt-6">
          <SubmitButton variant="secondary">Create quote from basket</SubmitButton>
        </form>
      )}
    </div>
  );
}
