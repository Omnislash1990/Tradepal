import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { addQuoteToBasketAction } from "@/app/actions/account";
import { PageHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { db } from "@/lib/db";
import { quotes } from "@/lib/db/schema";
import { formatGBP } from "@/lib/domain/money";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/lib/server/auth";

export default async function QuoteDetailPage({ params }: PageProps<"/account/quotes/[id]">) {
  const user = await requireUser("/account/quotes");
  const { id } = await params;
  const quote = await db.query.quotes.findFirst({ where: and(eq(quotes.id, id), eq(quotes.userId, user.id)) });
  if (!quote) notFound();
  return (
    <div>
      <PageHeader title={quote.number} description={`${quote.reference ?? "Quote"} · valid until ${formatDate(quote.validUntil)}`} />
      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b text-left text-ink-500">
            <th className="py-2">Item</th>
            <th>Qty</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {quote.lines.map((l) => (
            <tr key={l.productId} className="border-b border-ink-100">
              <td className="py-2">
                {l.name} <span className="text-ink-400">{l.sku}</span>
              </td>
              <td>{l.quantity}</td>
              <td className="text-right">{formatGBP(l.unitGross * l.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 font-bold">Total {formatGBP(quote.goodsGross + quote.deliveryGross)} inc VAT (delivery {formatGBP(quote.deliveryGross)})</p>
      <form action={addQuoteToBasketAction} className="mt-6">
        <input type="hidden" name="id" value={quote.id} />
        <SubmitButton>Add to basket</SubmitButton>
      </form>
      <p className="mt-4 text-xs text-ink-500">Print this page for a simple order document. Formal invoices are issued after payment.</p>
    </div>
  );
}
