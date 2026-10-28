import { Search } from "lucide-react";
import { cn } from "@/lib/cn";

export function SearchForm({
  defaultValue,
  size = "md",
  className,
  autoFocus,
  id = "site-search",
}: {
  defaultValue?: string;
  size?: "md" | "lg";
  className?: string;
  autoFocus?: boolean;
  id?: string;
}) {
  return (
    <form action="/search" method="get" role="search" className={cn("relative w-full", className)}>
      <label htmlFor={id} className="sr-only">
        Search products
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-ink-400" aria-hidden />
      <input
        id={id}
        name="q"
        type="search"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        placeholder="Search products, or describe a job…"
        autoComplete="off"
        className={cn(
          "w-full rounded-xl border-0 bg-white pr-4 pl-11 text-ink-900 shadow-sm ring-1 ring-inset ring-ink-300 placeholder:text-ink-400 focus:ring-2 focus:ring-brand-500 focus:outline-none",
          size === "lg" ? "h-14 text-base" : "h-11 text-[0.95rem]",
        )}
      />
    </form>
  );
}
