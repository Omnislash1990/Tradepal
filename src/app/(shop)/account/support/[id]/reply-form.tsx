"use client";

import { useActionState } from "react";
import { replyTicketAction } from "@/app/actions/support";
import { FormMessage, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function ReplyForm({ ticketId }: { ticketId: string }) {
  const [state, action] = useActionState(replyTicketAction, null);
  return (
    <form action={action} className="mt-6 space-y-3">
      <input type="hidden" name="ticketId" value={ticketId} />
      <Textarea name="body" required placeholder="Write a reply…" />
      <FormMessage tone={state?.ok ? "success" : "error"}>{state?.message}</FormMessage>
      <SubmitButton>Send reply</SubmitButton>
    </form>
  );
}
