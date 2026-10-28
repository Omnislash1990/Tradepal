"use client";

import { useActionState } from "react";
import { applyTradeAction } from "@/app/actions/account";
import { Field, FormMessage, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function TradeForm() {
  const [state, action] = useActionState(applyTradeAction, null);
  return (
    <form action={action} className="mt-8 max-w-lg space-y-4">
      <Field label="Company name" name="companyName">
        <Input id="companyName" name="companyName" required />
      </Field>
      <Field label="Trade type" name="tradeType">
        <Select id="tradeType" name="tradeType" defaultValue="General builder">
          <option>General builder</option>
          <option>Plasterer</option>
          <option>Electrician</option>
          <option>Plumber</option>
          <option>Decorator</option>
          <option>Property maintenance</option>
          <option>Other</option>
        </Select>
      </Field>
      <Field label="Company number (optional)" name="companyNumber">
        <Input id="companyNumber" name="companyNumber" />
      </Field>
      <Field label="VAT number (optional)" name="vatNumber">
        <Input id="vatNumber" name="vatNumber" />
      </Field>
      <Field label="Phone" name="phone">
        <Input id="phone" name="phone" type="tel" />
      </Field>
      <Field label="Typical monthly spend" name="monthlySpend">
        <Select id="monthlySpend" name="monthlySpend" defaultValue="£500–£2,000">
          <option>Under £500</option>
          <option>£500–£2,000</option>
          <option>£2,000–£5,000</option>
          <option>Over £5,000</option>
        </Select>
      </Field>
      <FormMessage tone={state?.ok ? "success" : "error"}>{state?.message}</FormMessage>
      <SubmitButton>Apply</SubmitButton>
    </form>
  );
}
