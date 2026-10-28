"use client";

import { useActionState } from "react";
import { registerAction } from "@/app/actions/auth";
import { Container } from "@/components/layout/container";
import { Checkbox, Field, FormMessage, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function RegisterForm({ next }: { next: string }) {
  const [state, action] = useActionState(registerAction, null);
  return (
    <Container width="narrow" className="py-12">
      <h1 className="text-3xl font-extrabold">Create an account</h1>
      <p className="mt-2 text-ink-600">
        Already registered?{" "}
        <a href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-brand-700">
          Sign in
        </a>
      </p>
      <form action={action} className="mt-8 space-y-4">
        <input type="hidden" name="next" value={next} />
        <Field label="Full name" name="name">
          <Input id="name" name="name" autoComplete="name" required />
        </Field>
        <Field label="Email" name="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password" name="password" hint="At least 8 characters.">
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <Checkbox name="marketing" label="Email me about offers and restocks (optional)" />
        <FormMessage>{state?.message}</FormMessage>
        <SubmitButton className="w-full" pendingText="Creating account…">
          Create account
        </SubmitButton>
      </form>
    </Container>
  );
}
