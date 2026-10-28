import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Container } from "@/components/layout/container";
import { CATEGORIES } from "@/lib/catalog/categories";

const HELP = [
  { href: "/help", label: "Help centre" },
  { href: "/delivery", label: "Delivery" },
  { href: "/returns", label: "Returns & refunds" },
  { href: "/contact", label: "Contact us" },
  { href: "/trade", label: "Trade accounts" },
];

const LEGAL = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/cookies", label: "Cookies" },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-ink-100 bg-ink-900 text-white">
      <Container className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo tone="white" size="md" />
          <p className="mt-4 max-w-xs text-sm text-white/70">Your building materials, sorted. Launching across the West Midlands.</p>
        </div>
        <div>
          <h2 className="text-sm font-bold tracking-wide uppercase">Shop</h2>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            {CATEGORIES.slice(0, 8).map((c) => (
              <li key={c.slug}>
                <Link href={`/c/${c.slug}`} className="hover:text-white">
                  {c.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/products" className="hover:text-white">
                All products
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-bold tracking-wide uppercase">Help</h2>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            {HELP.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-bold tracking-wide uppercase">Legal</h2>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            {LEGAL.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>
      <div className="border-t border-white/10">
        <Container className="flex flex-col gap-2 py-4 text-xs text-white/50 sm:flex-row sm:justify-between">
          <p>© 2026 Tradepal. Prices include VAT unless you choose to view them excluding VAT.</p>
          <p>AI quantity estimates are a guide — always review before you buy.</p>
        </Container>
      </div>
    </footer>
  );
}
