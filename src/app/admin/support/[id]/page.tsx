import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { replyStaffTicketAction } from "@/app/actions/admin";
import { AdminForm } from "../../admin-form";
import { PageHeader } from "@/components/ui/card";
import { Checkbox, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { db } from "@/lib/db";
import { supportTickets } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";
import { requireStaff } from "@/lib/server/auth";

export default async function AdminTicketPage({ params }: PageProps<"/admin/support/[id]">) {
  await requireStaff("support.manage");
  const { id } = await params;
  const ticket = await db.query.supportTickets.findFirst({ where: eq(supportTickets.id, id), with: { messages: true } });
  if (!ticket) notFound();
  return (
    <div>
      <PageHeader title={ticket.subject} description={`${ticket.number} · ${ticket.email} · ${ticket.status}`} />
      <ol className="mt-6 space-y-3">
        {ticket.messages.map((m) => (
          <li key={m.id} className="rounded-2xl bg-mist p-4">
            <p className="text-xs text-ink-500">
              {m.authorName} ({m.author}) · {formatDateTime(m.createdAt)}
            </p>
            <p className="mt-2 whitespace-pre-wrap">{m.body}</p>
          </li>
        ))}
      </ol>
      <AdminForm action={replyStaffTicketAction} className="mt-6 max-w-xl space-y-3">
        <input type="hidden" name="ticketId" value={ticket.id} />
        <Textarea name="body" required />
        <Checkbox name="resolve" label="Mark resolved" />
        <SubmitButton>Send reply</SubmitButton>
      </AdminForm>
    </div>
  );
}
