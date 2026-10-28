import { eq } from "drizzle-orm";
import { addListToBasketAction, deleteListAction } from "@/app/actions/account";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { CreateListForm } from "./create-list-form";
import { db } from "@/lib/db";
import { lists } from "@/lib/db/schema";
import { requireUser } from "@/lib/server/auth";

export const metadata = { title: "Lists" };

export default async function ListsPage() {
  const user = await requireUser("/account/lists");
  const rows = await db.query.lists.findMany({ where: eq(lists.userId, user.id), with: { items: true } });
  return (
    <div>
      <PageHeader title="Saved lists" description="Job lists and restock lists you can send to the basket." />
      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No lists yet" />
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 ring-1 ring-ink-200">
              <a href={`/account/lists/${l.id}`} className="font-semibold hover:text-brand-700">
                {l.name} <span className="font-normal text-ink-500">({l.items.length} items)</span>
              </a>
              <div className="flex gap-2">
                <form action={addListToBasketAction}>
                  <input type="hidden" name="listId" value={l.id} />
                  <SubmitButton size="sm">Add to basket</SubmitButton>
                </form>
                <form action={deleteListAction}>
                  <input type="hidden" name="id" value={l.id} />
                  <SubmitButton size="sm" variant="ghost">
                    Delete
                  </SubmitButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
      <h2 className="mt-10 font-bold">New list</h2>
      <CreateListForm />
    </div>
  );
}
