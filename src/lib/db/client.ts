import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

export type Db = LibSQLDatabase<typeof schema>;

export const DEFAULT_DATABASE_URL = "file:./data/tradepal.db";

export function databaseUrl(): string {
  return process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
}

/** Path of a local SQLite database, or null when using a remote libSQL/Turso database. */
export function localDatabasePath(url = databaseUrl()): string | null {
  if (!url.startsWith("file:")) return null;
  return path.resolve(process.cwd(), url.slice("file:".length));
}

export function createDb(url = databaseUrl()): { db: Db; client: Client } {
  const local = localDatabasePath(url);
  if (local) mkdirSync(path.dirname(local), { recursive: true });
  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
  return { db: drizzle(client, { schema }), client };
}
