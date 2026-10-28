import { Container } from "@/components/layout/container";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { TradeForm } from "./trade-form";
import { getCurrentUser } from "@/lib/server/auth";

export const metadata = { title: "Trade accounts" };

export default async function TradePage() {
  const user = await getCurrentUser();
  return (
    <Container className="py-10">
      <PageHeader
        title="Trade accounts"
        description="Approved trades get saved job lists, quotes and agreed discounts. Credit facilities are not offered in this first release."
      />
      <ul className="mt-6 max-w-xl list-disc space-y-2 pl-5 text-ink-700">
        <li>Repeat orders and saved site addresses</li>
        <li>Downloadable quotes for customers</li>
        <li>Trade pricing only where we have agreed it</li>
      </ul>
      {!user && (
        <p className="mt-6">
          <ButtonLink href="/register?next=/trade">Create an account first</ButtonLink>
        </p>
      )}
      {user?.tradeStatus === "approved" && (
        <p className="mt-6 font-semibold text-success-700">Your trade account is approved. Trade prices are already showing.</p>
      )}
      {user && user.tradeStatus !== "approved" && <TradeForm />}
    </Container>
  );
}
