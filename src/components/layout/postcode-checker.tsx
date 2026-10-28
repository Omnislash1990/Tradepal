"use client";

import { MapPin } from "lucide-react";
import { useActionState } from "react";
import { joinWaitlistAction, setPostcodeAction } from "@/app/actions/basket";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";

export function PostcodeChecker({
  current,
  compact = false,
  className,
}: {
  current?: string | null;
  compact?: boolean;
  className?: string;
}) {
  const [state, action] = useActionState(setPostcodeAction, null);
  const [waitlist, waitAction] = useActionState(joinWaitlistAction, null);
  const showWaitlist = state?.status === "coming_soon" || state?.status === "outside";

  if (compact) {
    return (
      <form action={action} className={cn("flex items-center gap-2", className)}>
        <MapPin className="size-4 shrink-0 text-brand-600" aria-hidden />
        <label htmlFor="postcode-compact" className="sr-only">
          Delivery postcode
        </label>
        <input
          id="postcode-compact"
          name="postcode"
          defaultValue={current ?? ""}
          placeholder="Postcode"
          autoComplete="postal-code"
          className="h-8 w-28 rounded-lg bg-white px-2 text-sm ring-1 ring-ink-200 focus:ring-2 focus:ring-brand-500 focus:outline-none"
        />
        <SubmitButton size="sm" variant="ghost" className="h-8 px-2 text-xs">
          Check
        </SubmitButton>
        {state?.message && (
          <span className={cn("hidden text-xs sm:inline", state.ok ? "text-success-700" : "text-ink-600")}>{state.message}</span>
        )}
      </form>
    );
  }

  return (
    <div className={className}>
      <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="postcode" className="mb-1.5 block text-sm font-semibold text-ink-800">
            Delivery postcode
          </label>
          <Input id="postcode" name="postcode" defaultValue={current ?? ""} placeholder="e.g. B15 2TT" autoComplete="postal-code" />
        </div>
        <SubmitButton pendingText="Checking…">{current ? "Update" : "Check delivery"}</SubmitButton>
      </form>
      {state?.message && (
        <p className={cn("mt-3 text-sm font-medium", state.ok ? "text-success-700" : "text-ink-700")} role="status">
          {state.message}
        </p>
      )}
      {showWaitlist && (
        <form action={waitAction} className="mt-4 flex flex-col gap-2 rounded-xl bg-mist p-4 sm:flex-row">
          <input type="hidden" name="postcode" value={state?.postcode ?? ""} />
          <Input name="email" type="email" placeholder="Your email" autoComplete="email" required aria-label="Email for waiting list" />
          <SubmitButton variant="navy" pendingText="Joining…">
            Join waiting list
          </SubmitButton>
        </form>
      )}
      {waitlist?.message && (
        <p className={cn("mt-2 text-sm font-medium", waitlist.ok ? "text-success-700" : "text-danger-700")} role="status">
          {waitlist.message}
        </p>
      )}
    </div>
  );
}
