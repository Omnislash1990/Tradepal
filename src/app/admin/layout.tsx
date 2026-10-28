import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { requireStaff } from "@/lib/server/auth";

export const instant = false;

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/suppliers", label: "Suppliers" },
  { href: "/admin/pricing", label: "Pricing" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/support", label: "Support" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/outbox", label: "Email outbox" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  return (
    <div className="flex min-h-full">
      <aside className="hidden w-56 shrink-0 border-r border-ink-100 bg-ink-900 text-white md:block">
        <div className="p-4">
          <Logo tone="white" size="sm" />
          <p className="mt-2 text-xs text-white/60">Admin · {user.name}</p>
        </div>
        <nav className="px-2 pb-8">
          {NAV.map((l) => (
            <Link key={l.href} href={l.href} className="block rounded-lg px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white">
              {l.label}
            </Link>
          ))}
          <Link href="/" className="mt-4 block rounded-lg px-3 py-2 text-sm text-white/50 hover:text-white">
            Back to shop
          </Link>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex gap-2 overflow-x-auto border-b border-ink-100 px-4 py-3 md:hidden">
          {NAV.map((l) => (
            <Link key={l.href} href={l.href} className="shrink-0 rounded-lg bg-mist px-3 py-1.5 text-sm font-semibold">
              {l.label}
            </Link>
          ))}
        </div>
        <div className="flex-1 p-4 sm:p-6 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
