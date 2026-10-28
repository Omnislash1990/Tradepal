"use client";

import { useActionState } from "react";
import { changePasswordAction, updateProfileAction } from "@/app/actions/auth";
import { Checkbox, Field, FormMessage, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

type ProfileUser = {
  name: string;
  phone: string | null;
  marketingOptIn: boolean;
  pricesExVat: boolean;
};

export function ProfileForm({ user }: { user: ProfileUser }) {
  const [profile, profileAction] = useActionState(updateProfileAction, null);
  const [password, passwordAction] = useActionState(changePasswordAction, null);
  return (
    <div className="mt-4 grid gap-8 lg:grid-cols-2">
      <form action={profileAction} className="space-y-4">
        <Field label="Name" name="name">
          <Input id="name" name="name" defaultValue={user.name} required />
        </Field>
        <Field label="Phone" name="phone">
          <Input id="phone" name="phone" type="tel" defaultValue={user.phone ?? ""} />
        </Field>
        <Checkbox name="marketing" defaultChecked={user.marketingOptIn} label="Email me about offers" />
        <Checkbox name="pricesExVat" defaultChecked={user.pricesExVat} label="Show prices excluding VAT" />
        <FormMessage tone={profile?.ok ? "success" : "error"}>{profile?.message}</FormMessage>
        <SubmitButton>Save details</SubmitButton>
      </form>
      <form action={passwordAction} className="space-y-4">
        <Field label="Current password" name="current">
          <Input id="current" name="current" type="password" autoComplete="current-password" required />
        </Field>
        <Field label="New password" name="next">
          <Input id="next" name="next" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <FormMessage tone={password?.ok ? "success" : "error"}>{password?.message}</FormMessage>
        <SubmitButton variant="secondary">Change password</SubmitButton>
      </form>
    </div>
  );
}
