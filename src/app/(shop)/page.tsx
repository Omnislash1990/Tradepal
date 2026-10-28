import { Sparkles, Truck, WalletCards, Wrench } from "lucide-react";
import Link from "next/link";
import { CategoryGrid } from "@/components/catalog/category-grid";
import { Container } from "@/components/layout/container";
import { PostcodeChecker } from "@/components/layout/postcode-checker";
import { SearchForm } from "@/components/layout/search-form";
import { ProductGrid } from "@/components/product/product-card";
import { ButtonLink } from "@/components/ui/button";
import { JOB_STARTERS } from "@/lib/domain/assistant/engine";
import { queryProducts } from "@/lib/server/catalog";
import { getViewer, priceContext } from "@/lib/server/context";

export default async function HomePage() {
  const viewer = await getViewer();
  const ctx = priceContext(viewer);
  const [{ items: popular }, { items: offers }] = await Promise.all([
    queryProducts({ sort: "popular" }, ctx),
    queryProducts({ onOffer: true, sort: "popular" }, ctx),
  ]);

  return (
    <>
      <section className="bg-linear-to-br from-brand-600 via-brand-500 to-brand-700 text-white">
        <Container className="grid items-center gap-10 py-12 lg:grid-cols-2 lg:py-16">
          <div>
            <p className="text-sm font-semibold tracking-wide text-brand-100 uppercase">West Midlands · building materials</p>
            <h1 className="mt-3 max-w-xl text-4xl font-extrabold tracking-tight sm:text-5xl">Your building materials, sorted.</h1>
            <p className="mt-4 max-w-lg text-lg text-white/85">
              Search a practical catalogue, check delivery, or describe a job to the assistant and we&apos;ll estimate the materials.
            </p>
            <div className="mt-8 max-w-xl">
              <SearchForm size="lg" id="home-search" className="[&_input]:h-14 [&_input]:text-ink-900" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {JOB_STARTERS.slice(0, 3).map((q) => (
                <Link
                  key={q}
                  href={`/assistant?q=${encodeURIComponent(q)}`}
                  className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium hover:bg-white/25"
                >
                  {q}
                </Link>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-white p-5 text-ink-900 shadow-lift">
            <h2 className="font-bold">Do we deliver to you?</h2>
            <p className="mt-1 text-sm text-ink-600">We&apos;re starting in Birmingham, the Black Country and Coventry.</p>
            <div className="mt-4">
              <PostcodeChecker current={viewer.postcode?.formatted} />
            </div>
          </div>
        </Container>
      </section>

      <Container className="py-12">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-extrabold">Shop by category</h2>
          <Link href="/products" className="text-sm font-semibold text-brand-700 hover:underline">
            All products
          </Link>
        </div>
        <CategoryGrid className="mt-6" compact />
      </Container>

      {offers.length > 0 && (
        <section className="bg-mist py-12">
          <Container>
            <div className="flex items-end justify-between">
              <h2 className="text-2xl font-extrabold">Offers</h2>
              <Link href="/offers" className="text-sm font-semibold text-brand-700 hover:underline">
                View all
              </Link>
            </div>
            <div className="mt-6">
              <ProductGrid products={offers.slice(0, 8)} exVat={viewer.exVat} />
            </div>
          </Container>
        </section>
      )}

      <Container className="py-12">
        <h2 className="text-2xl font-extrabold">Popular right now</h2>
        <div className="mt-6">
          <ProductGrid products={popular.slice(0, 8)} exVat={viewer.exVat} />
        </div>
      </Container>

      <section className="bg-ink-900 py-12 text-white">
        <Container className="grid items-center gap-8 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-brand-200">AI assistant</p>
            <h2 className="mt-2 text-3xl font-extrabold">Describe the job. Get a materials list.</h2>
            <p className="mt-3 text-white/75">
              Quantities are estimates with the assumptions shown. You review and edit everything before it goes in the basket.
            </p>
            <ButtonLink href="/assistant" variant="white" className="mt-6">
              <Sparkles className="size-4" />
              Open the assistant
            </ButtonLink>
          </div>
          <ul className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: Sparkles, title: "Find it", text: "Natural language, not just product names." },
              { icon: Wrench, title: "Estimate it", text: "Boards, paint, tiles, fencing and more." },
              { icon: Truck, title: "Order it", text: "Split deliveries shown clearly at checkout." },
            ].map((s) => (
              <li key={s.title} className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <s.icon className="size-6 text-brand-200" />
                <p className="mt-3 font-bold">{s.title}</p>
                <p className="mt-1 text-sm text-white/70">{s.text}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <Container className="grid gap-6 py-12 sm:grid-cols-3">
        <div className="rounded-2xl bg-mist p-5">
          <Truck className="size-6 text-brand-600" />
          <h3 className="mt-3 font-bold">Local delivery</h3>
          <p className="mt-1 text-sm text-ink-600">Van, parcel and heavy goods, with dates once we have your postcode.</p>
        </div>
        <div className="rounded-2xl bg-mist p-5">
          <WalletCards className="size-6 text-brand-600" />
          <h3 className="mt-3 font-bold">Clear prices</h3>
          <p className="mt-1 text-sm text-ink-600">Inc or ex VAT, with trade pricing on approved accounts.</p>
        </div>
        <div className="rounded-2xl bg-mist p-5">
          <Wrench className="size-6 text-brand-600" />
          <h3 className="mt-3 font-bold">For trade and DIY</h3>
          <p className="mt-1 text-sm text-ink-600">
            Job lists, repeat orders and quotes for trades. Simple search for everyone else.{" "}
            <Link href="/trade" className="font-semibold text-brand-700">
              Apply for trade
            </Link>
          </p>
        </div>
      </Container>
    </>
  );
}
