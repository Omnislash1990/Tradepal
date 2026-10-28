import Link from "next/link";
import { requireUser } from "@/lib/server/auth";
import { Container } from "@/components/layout/container";

const LINKS = [
  { href: "/account", label: "Overview" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/lists", label: "Lists" },
  { href: "/account/quotes", label: "Quotes" },
  { href: "/account/trade", label: "Trade" },
  { href: "/account/support", label: "Support" },
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireUser("/account");
  return (
    <Container className="py-8">
      <div className="grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav className="h-fit rounded-2xl bg-mist p-3">
          <p className="px-3 py-2 text-xs font-bold tracking-wide text-ink-500 uppercase">Account</p>
          <ul>
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="block rounded-xl px-3 py-2 text-sm font-semibold hover:bg-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <form action={async () => {
            "use server";
            const { logoutAction } = await import("@/app/actions/auth");
            await logoutAction();
          }} className="mt-2">
            <button type="submit" className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-danger-700 hover:bg-white">
              Sign out
            </button>
          </form>
        </nav>
        <div>{children}</div>
      </div>
    </Container>
  );
}
