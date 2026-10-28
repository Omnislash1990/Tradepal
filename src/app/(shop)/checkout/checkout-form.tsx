"use client";

import { useActionState, useState } from "react";
import { placeOrderAction } from "@/app/actions/checkout";
import { AddressFields } from "@/components/checkout/address-fields";
import { Checkbox, Field, FormMessage, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

type Saved = { id: string; label: string | null; name: string; line1: string; town: string; postcode: string };

export function CheckoutForm({
  email,
  name,
  isTrade,
  signedIn,
  saved,
  defaultPostcode,
  stripe,
}: {
  email: string;
  name: string;
  isTrade: boolean;
  signedIn: boolean;
  saved: Saved[];
  defaultPostcode: string;
  stripe: boolean;
}) {
  const [state, action] = useActionState(placeOrderAction, null);
  const [addressId, setAddressId] = useState(saved.find((a) => a.postcode === defaultPostcode)?.id ?? saved[0]?.id ?? "");

  return (
    <form action={action} className="space-y-6 rounded-2xl bg-white p-5 shadow-card ring-1 ring-ink-200">
      <h2 className="font-bold">Contact</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" name="email">
          <Input id="email" name="email" type="email" defaultValue={email} autoComplete="email" required />
        </Field>
        <Field label="Your name" name="customerName">
          <Input id="customerName" name="customerName" defaultValue={name} autoComplete="name" required />
        </Field>
      </div>
      {isTrade && (
        <Field label="Purchase order / job reference" name="poReference">
          <Input id="poReference" name="poReference" />
        </Field>
      )}

      <h2 className="font-bold">Delivery address</h2>
      {saved.length > 0 && (
        <div className="space-y-2">
          {saved.map((a) => (
            <label key={a.id} className="flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 ring-ink-200 has-checked:ring-brand-500">
              <input type="radio" name="addressId" value={a.id} checked={addressId === a.id} onChange={() => setAddressId(a.id)} className="mt-1" />
              <span>
                <span className="font-semibold">{a.label ?? "Address"}</span>
                <span className="block text-sm text-ink-600">
                  {a.name}, {a.line1}, {a.town}, {a.postcode}
                </span>
              </span>
            </label>
          ))}
          <label className="flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 ring-ink-200 has-checked:ring-brand-500">
            <input type="radio" name="addressId" value="" checked={addressId === ""} onChange={() => setAddressId("")} className="mt-1" />
            <span className="font-semibold">Use a new address</span>
          </label>
        </div>
      )}
      {(!saved.length || addressId === "") && (
        <>
          <AddressFields defaults={{ postcode: defaultPostcode, name }} />
          {signedIn && (
            <Checkbox name="saveAddress" label="Save this address to my account" />
          )}
        </>
      )}

      <Field label="Order notes (optional)" name="notes">
        <Textarea id="notes" name="notes" rows={3} placeholder="Site access, preferred time window…" />
      </Field>

      <FormMessage>{state?.ok === false ? state.message : null}</FormMessage>

      {stripe ? (
        <SubmitButton className="w-full" pendingText="Redirecting to payment…">
          Pay securely
        </SubmitButton>
      ) : (
        <>
          <input type="hidden" name="pay" value="demo" />
          <SubmitButton className="w-full" pendingText="Placing order…">
            Place order (demo payment)
          </SubmitButton>
          <p className="text-xs text-ink-500">
            Stripe isn&apos;t configured, so this records a simulated payment. Add STRIPE_SECRET_KEY to take real card payments.
          </p>
        </>
      )}
      <p className="text-xs text-ink-500">
        By placing this order you agree to our{" "}
        <a href="/terms" className="underline">
          terms
        </a>{" "}
        and{" "}
        <a href="/returns" className="underline">
          returns policy
        </a>
        .
      </p>
    </form>
  );
}
