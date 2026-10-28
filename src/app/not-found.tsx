import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm font-semibold text-brand-600">404</p>
      <h1 className="mt-2 text-3xl font-extrabold">We couldn&apos;t find that page</h1>
      <p className="mt-3 text-ink-600">It may have moved, or the product is no longer listed. Try search or head back to the shop.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/">Home</ButtonLink>
        <ButtonLink href="/products" variant="secondary">
          Browse products
        </ButtonLink>
      </div>
    </main>
  );
}
