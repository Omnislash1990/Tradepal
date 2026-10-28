import { eq } from "drizzle-orm";
import { deleteAddressAction } from "@/app/actions/account";
import { PageHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { AddressForm } from "./address-form";
import { db } from "@/lib/db";
import { addresses } from "@/lib/db/schema";
import { formatAddress } from "@/lib/format";
import { requireUser } from "@/lib/server/auth";

export const metadata = { title: "Addresses" };

export default async function AddressesPage() {
  const user = await requireUser("/account/addresses");
  const rows = await db.query.addresses.findMany({ where: eq(addresses.userId, user.id) });
  return (
    <div>
      <PageHeader title="Saved addresses" />
      <ul className="mt-6 space-y-3">
        {rows.map((a) => (
          <li key={a.id} className="flex items-start justify-between gap-4 rounded-2xl p-4 ring-1 ring-ink-200">
            <div>
              <p className="font-semibold">
                {a.label} {a.isDefault && <span className="text-xs text-brand-700">Default</span>}
              </p>
              <p className="text-sm text-ink-600 whitespace-pre-line">{formatAddress(a, { multiline: true })}</p>
            </div>
            <form action={deleteAddressAction}>
              <input type="hidden" name="id" value={a.id} />
              <SubmitButton variant="ghost" size="sm">
                Remove
              </SubmitButton>
            </form>
          </li>
        ))}
      </ul>
      <h2 className="mt-10 font-bold">Add address</h2>
      <AddressForm />
    </div>
  );
}
