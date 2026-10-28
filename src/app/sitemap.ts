import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/lib/catalog/categories";
import { loadCatalog } from "@/lib/server/catalog";
import { appUrl } from "@/lib/server/notify";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalog = await loadCatalog();
  const staticPaths = ["/", "/products", "/assistant", "/offers", "/trade", "/help", "/delivery", "/returns", "/contact", "/privacy", "/terms", "/cookies"];
  const now = new Date();
  return [
    ...staticPaths.map((path) => ({ url: appUrl(path), lastModified: now })),
    ...CATEGORIES.map((c) => ({ url: appUrl(`/c/${c.slug}`), lastModified: now })),
    ...catalog.products.map((p) => ({ url: appUrl(`/products/${p.slug}`), lastModified: p.updatedAt ?? now })),
  ];
}
