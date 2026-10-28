"use client";

import { useActionState } from "react";
import { createTicketAction } from "@/app/actions/support";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function ContactForm({ name, email }: { name: string; email: string }) {
  const [state, action] = useActionState(createTicketAction, null);
  return (
    <form action={action} className="mt-8 space-y-4">
      <Field label="Name" name="name">
        <Input id="name" name="name" defaultValue={name} required />
      </Field>
      <Field label="Email" name="email">
        <Input id="email" name="email" type="email" defaultValue={email} required />
      </Field>
      <Field label="Topic" name="topic">
        <Select id="topic" name="topic" defaultValue="other">
          <option value="order">Order</option>
          <option value="delivery">Delivery</option>
          <option value="product">Product</option>
          <option value="return">Return</option>
          <option value="account">Account</option>
          <option value="trade">Trade</option>
          <option value="other">Other</option>
        </Select>
      </Field>
      <Field label="Subject" name="subject">
        <Input id="subject" name="subject" required />
      </Field>
      <Field label="Message" name="body">
        <Textarea id="body" name="body" required />
      </Field>
      <FormMessage tone={state?.ok ? "success" : "error"}>{state?.message}</FormMessage>
      <SubmitButton>Send</SubmitButton>
    </form>
  );
}
