import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { db } from "@/lib/db";
import { tradeAccounts } from "@/lib/db/schema";
import { formatBps } from "@/lib/domain/money";
import { requireUser } from "@/lib/server/auth";

export const metadata = { title: "Trade account" };

export default async function AccountTradePage() {
  const user = await requireUser("/account/trade");
  const account = await db.query.tradeAccounts.findFirst({ where: eq(tradeAccounts.userId, user.id) });
  return (
    <div>
      <PageHeader title="Trade account" />
      {!account && (
        <p className="mt-4 text-ink-600">
          You haven&apos;t applied yet.{" "}
          <ButtonLink href="/trade" className="ml-2">
            Apply
          </ButtonLink>
        </p>
      )}
      {account && (
        <dl className="mt-6 max-w-lg space-y-2 text-sm">
          <div className="flex justify-between">
            <dt>Company</dt>
            <dd className="font-medium">{account.companyName}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Status</dt>
            <dd className="font-medium capitalize">{account.status}</dd>
          </div>
          {account.status === "approved" && (
            <div className="flex justify-between">
              <dt>Discount</dt>
              <dd>{formatBps(account.discountBps)}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
