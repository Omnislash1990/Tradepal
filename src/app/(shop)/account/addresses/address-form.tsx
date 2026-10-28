"use client";

import { useActionState } from "react";
import { saveAddressAction } from "@/app/actions/account";
import { AddressFields } from "@/components/checkout/address-fields";
import { Checkbox, Field, FormMessage, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function AddressForm() {
  const [state, action] = useActionState(saveAddressAction, null);
  return (
    <form action={action} className="mt-4 max-w-xl space-y-4">
      <Field label="Label" name="label">
        <Input id="label" name="label" placeholder="Home, site, yard…" />
      </Field>
      <AddressFields />
      <Checkbox name="isDefault" label="Default delivery address" />
      <FormMessage tone={state?.ok ? "success" : "error"}>{state?.message}</FormMessage>
      <SubmitButton>Save address</SubmitButton>
    </form>
  );
}
