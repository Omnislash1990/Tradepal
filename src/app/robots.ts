import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/server/notify";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/checkout", "/api"] },
    sitemap: appUrl("/sitemap.xml"),
  };
}
