import { Select } from "@/components/ui/field";
import type { CatalogSort, AvailabilityFilter } from "@/lib/server/catalog";

export function CatalogFilters({
  sort,
  availability,
  onOffer,
  action = "/products",
  extra,
}: {
  sort?: CatalogSort;
  availability?: AvailabilityFilter;
  onOffer?: boolean;
  action?: string;
  extra?: Record<string, string | undefined>;
}) {
  return (
    <form action={action} method="get" className="flex flex-wrap items-end gap-3">
      {extra &&
        Object.entries(extra).map(
          ([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />,
        )}
      <div>
        <label htmlFor="sort" className="mb-1 block text-xs font-semibold text-ink-600">
          Sort
        </label>
        <Select id="sort" name="sort" defaultValue={sort ?? "popular"} className="h-10 min-w-40">
          <option value="popular">Popular</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="name">Name</option>
          {extra?.q && <option value="relevance">Relevance</option>}
        </Select>
      </div>
      <div>
        <label htmlFor="availability" className="mb-1 block text-xs font-semibold text-ink-600">
          Availability
        </label>
        <Select id="availability" name="availability" defaultValue={availability ?? "all"} className="h-10 min-w-40">
          <option value="all">All</option>
          <option value="in-stock">In stock / available</option>
          <option value="verified">Verified stock only</option>
        </Select>
      </div>
      <label className="mb-2 flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="offer" value="1" defaultChecked={onOffer} className="size-4 accent-brand-500" />
        On offer
      </label>
      <button type="submit" className="mb-0.5 h-10 rounded-xl bg-ink-900 px-4 text-sm font-semibold text-white hover:bg-ink-800">
        Apply
      </button>
    </form>
  );
}
