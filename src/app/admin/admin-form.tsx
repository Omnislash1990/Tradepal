"use client";

import { useActionState, type ReactNode } from "react";
import type { AdminResult } from "@/app/actions/admin";
import { FormMessage } from "@/components/ui/field";

export function AdminForm({
  action,
  children,
  className,
}: {
  action: (prev: AdminResult, formData: FormData) => Promise<AdminResult>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      <FormMessage tone={state?.ok ? "success" : "error"}>{state?.message}</FormMessage>
    </form>
  );
}
