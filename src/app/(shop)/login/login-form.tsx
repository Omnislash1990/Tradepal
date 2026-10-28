"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import { Container } from "@/components/layout/container";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { DEMO_ACCOUNTS } from "@/lib/demo-accounts";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(loginAction, null);
  return (
    <Container width="narrow" className="py-12">
      <h1 className="text-3xl font-extrabold">Sign in</h1>
      <p className="mt-2 text-ink-600">
        New here?{" "}
        <a href={`/register?next=${encodeURIComponent(next)}`} className="font-semibold text-brand-700">
          Create an account
        </a>
      </p>
      <form action={action} className="mt-8 space-y-4">
        <input type="hidden" name="next" value={next} />
        <Field label="Email" name="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password" name="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <FormMessage>{state?.message}</FormMessage>
        <SubmitButton className="w-full" pendingText="Signing in…">
          Sign in
        </SubmitButton>
      </form>
      <div className="mt-8 rounded-2xl bg-mist p-4 text-sm">
        <p className="font-semibold">Sample accounts for this demo</p>
        <ul className="mt-2 space-y-1 text-ink-700">
          {Object.entries(DEMO_ACCOUNTS).map(([role, a]) => (
            <li key={role}>
              <span className="capitalize">{role}</span>: {a.email}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink-500">Passwords are in the project README / seed. Change them before any real use.</p>
      </div>
    </Container>
  );
}
