import { describe, expect, it } from "vitest";
import { CATEGORIES } from "@/lib/catalog/categories";
import { SEED_PRODUCTS } from "@/lib/catalog/products";
import { detectJobInQuery, prepareDocs, searchDocs } from "./search";

const docs = prepareDocs(
  SEED_PRODUCTS.map((p) => ({
    id: p.sku,
    sku: p.sku,
    name: p.name,
    brand: null,
    categoryName: CATEGORIES.find((c) => c.slug === p.category)!.name,
    tags: p.tags,
    description: p.description,
    popularity: 0,
  })),
);
const top = (q: string) => searchDocs(docs, q)[0]?.doc.sku;

describe("search", () => {
  it("finds products by name", () => {
    expect(top("drywall screws")).toBe("FX-DWS-38-1000");
    expect(top("15mm copper pipe")).toBe("PH-CU-15-3");
    expect(top("multi finish")).toBe("PL-MF-25");
  });

  it("understands trade slang and everyday words", () => {
    expect(top("no nails")).toBe("FX-GRAB-290");
    expect(top("loo")).toBe("BA-WC-CC");
    expect(top("postcrete")).toBe("LF-POSTMIX-20");
    expect(searchDocs(docs, "something to fill holes in the wall").map((r) => r.doc.sku)).toContain("DC-FILLER-RM");
  });

  it("tolerates typos and plurals", () => {
    expect(searchDocs(docs, "plasterbord").map((r) => r.doc.sku)).toContain("PB-STD-125-TE");
    expect(top("fence panels")).toMatch(/^LF-PANEL/);
  });

  it("matches SKUs exactly", () => {
    expect(searchDocs(docs, "pb-std-125-te")).toHaveLength(1);
  });

  it("returns nothing for unrelated queries", () => {
    expect(searchDocs(docs, "unicorn saddle")).toHaveLength(0);
  });

  it("spots job descriptions", () => {
    expect(detectJobInQuery("tile my bathroom floor")).toBe("tile");
    expect(detectJobInQuery("grab adhesive")).toBeNull();
  });
});
