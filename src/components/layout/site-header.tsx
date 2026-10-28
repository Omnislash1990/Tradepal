import { ShoppingBasket, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SearchForm } from "@/components/layout/search-form";
import { VatToggle } from "@/components/layout/vat-toggle";
import { CATEGORIES } from "@/lib/catalog/categories";
import { getBasketCount } from "@/lib/server/basket";
import { getViewer } from "@/lib/server/context";

export async function SiteHeader() {
  const [viewer, count] = await Promise.all([getViewer(), getBasketCount()]);
  const user = viewer.user;
  const isStaff = user?.role === "staff" || user?.role === "admin";

  return (
    <header className="sticky top-0 z-40 bg-white/95 shadow-sm backdrop-blur">
      <div className="border-b border-ink-100 bg-mist">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-1.5 text-xs text-ink-600 sm:px-6 lg:px-8">
          <p>
            Delivering across Birmingham, the Black Country and Coventry
            {viewer.postcode ? (
              <>
                {" "}
                · <span className="font-semibold text-ink-800">{viewer.postcode.formatted}</span>
              </>
            ) : null}
          </p>
          <div className="flex items-center gap-3">
            <VatToggle exVat={viewer.exVat} />
            <Link href="/trade" className="hidden font-semibold hover:text-brand-700 sm:inline">
              Trade account
            </Link>
            {isStaff && (
              <Link href="/admin" className="font-semibold text-brand-700 hover:text-brand-800">
                Admin
              </Link>
            )}
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <MobileNav signedIn={!!user} isStaff={!!isStaff} />
        <Link href="/" className="shrink-0" aria-label="Tradepal home">
          <Logo size="md" />
        </Link>
        <div className="hidden flex-1 lg:block">
          <SearchForm />
        </div>
        <nav className="ml-auto flex items-center gap-1 sm:ml-0">
          <Link
            href="/assistant"
            className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 md:inline-flex"
          >
            <Sparkles className="size-4" />
            Assistant
          </Link>
          <Link
            href={user ? "/account" : "/login"}
            className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-mist sm:inline-flex"
          >
            <UserRound className="size-4" />
            {user ? user.name.split(" ")[0] : "Sign in"}
          </Link>
          <Link href="/basket" className="relative inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-mist">
            <ShoppingBasket className="size-5" />
            <span className="hidden sm:inline">Basket</span>
            {count > 0 && (
              <span className="absolute top-1 right-1 grid min-w-5 place-items-center rounded-full bg-brand-500 px-1 text-[11px] font-bold text-white sm:static sm:min-w-6 sm:px-1.5 sm:py-0.5">
                {count}
              </span>
            )}
          </Link>
        </nav>
      </div>
      <div className="px-4 pb-3 lg:hidden sm:px-6">
        <SearchForm id="header-search-mobile" />
      </div>
      <nav aria-label="Product categories" className="hidden border-t border-ink-100 lg:block">
        <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-1.5 sm:px-6 lg:px-8">
          {CATEGORIES.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/c/${c.slug}`}
                className="inline-flex whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-mist hover:text-ink-900"
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

export function HeaderFallback() {
  return <div className="h-[7.5rem] border-b border-ink-100 bg-white lg:h-[8.75rem]" />;
}
