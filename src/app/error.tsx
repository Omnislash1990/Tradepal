"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm font-semibold text-danger-600">Something went wrong</p>
      <h1 className="mt-2 text-3xl font-extrabold">We hit a snag</h1>
      <p className="mt-3 text-ink-600">Please try again. If it keeps happening, contact us with this reference: {error.digest ?? "unknown"}.</p>
      <Button className="mt-8" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
