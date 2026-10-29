import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["@libsql/client", "libsql"],
  outputFileTracingIncludes: {
    "/*": [
      "./data/tradepal.db",
      "./drizzle/**/*",
      "./node_modules/libsql/**/*",
      "./node_modules/@libsql/linux-x64-gnu/**/*",
      "./node_modules/@libsql/linux-arm64-gnu/**/*",
    ],
  },
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
