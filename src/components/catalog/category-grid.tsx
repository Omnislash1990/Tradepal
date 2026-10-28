import Link from "next/link";
import { CATEGORIES } from "@/lib/catalog/categories";
import { CATEGORY_ICONS } from "@/lib/catalog/icons";
import { cn } from "@/lib/cn";

export function CategoryGrid({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <ul className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6", className)}>
      {CATEGORIES.map((c) => {
        const Icon = CATEGORY_ICONS[c.icon];
        return (
          <li key={c.slug}>
            <Link
              href={`/c/${c.slug}`}
              className="flex h-full flex-col rounded-2xl bg-white p-4 shadow-card ring-1 ring-ink-200 transition hover:shadow-lift hover:ring-brand-200"
            >
              {Icon && (
                <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon className="size-5" />
                </span>
              )}
              <span className="mt-3 font-semibold leading-snug">{c.name}</span>
              {!compact && <span className="mt-1 line-clamp-2 text-xs text-ink-500">{c.description}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
