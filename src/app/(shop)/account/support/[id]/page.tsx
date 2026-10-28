import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ReplyForm } from "./reply-form";
import { PageHeader } from "@/components/ui/card";
import { db } from "@/lib/db";
import { supportTickets } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";
import { requireUser } from "@/lib/server/auth";

export default async function TicketPage({ params }: PageProps<"/account/support/[id]">) {
  const user = await requireUser("/account/support");
  const { id } = await params;
  const ticket = await db.query.supportTickets.findFirst({
    where: and(eq(supportTickets.id, id), eq(supportTickets.userId, user.id)),
    with: { messages: true },
  });
  if (!ticket) notFound();
  return (
    <div>
      <PageHeader title={ticket.subject} description={`${ticket.number} · ${ticket.status}`} />
      <ol className="mt-6 space-y-4">
        {ticket.messages.map((m) => (
          <li key={m.id} className="rounded-2xl bg-mist p-4">
            <p className="text-xs font-semibold text-ink-500">
              {m.authorName} · {formatDateTime(m.createdAt)}
            </p>
            <p className="mt-2 whitespace-pre-wrap">{m.body}</p>
          </li>
        ))}
      </ol>
      <ReplyForm ticketId={ticket.id} />
    </div>
  );
}
