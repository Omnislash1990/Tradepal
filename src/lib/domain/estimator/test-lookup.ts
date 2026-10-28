import { referenceGross, SEED_PRODUCTS } from "@/lib/catalog/products";
import type { MaterialLookup, MaterialProduct } from "./types";

/** Catalogue lookup for tests and offline previews, priced at the reference markup. */
export function seedLookup(): MaterialLookup {
  const map = new Map<string, MaterialProduct>(
    SEED_PRODUCTS.map((p) => [
      p.sku,
      {
        sku: p.sku,
        name: p.name,
        unitGross: referenceGross(p.costNet),
        available: p.stock !== "out",
        attributes: p.attributes ?? {},
      },
    ]),
  );
  return (sku) => map.get(sku);
}
