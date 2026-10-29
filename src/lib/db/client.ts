import { copyFileSync, existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient as createNodeClient, type Client } from "@libsql/client/node";
import { createClient as createWebClient } from "@libsql/client/web";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

export type Db = LibSQLDatabase<typeof schema>;

export const BUNDLED_DATABASE_REL = "data/tradepal.db";
export const DEFAULT_DATABASE_URL = "file:./data/tradepal.db";

function envUrl(): string {
  return (process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "").trim();
}

export function databaseAuthToken(): string | undefined {
  return process.env.DATABASE_AUTH_TOKEN?.trim() || process.env.TURSO_AUTH_TOKEN?.trim() || undefined;
}

export function isRemoteDatabaseUrl(url: string): boolean {
  return /^(libsql|https?|wss?):/i.test(url);
}

function canWriteDir(dir: string): boolean {
  try {
    mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, ".tp-write-probe");
    writeFileSync(probe, "ok");
    unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

/** Absolute path for a local SQLite file, using /tmp when the project directory is read-only (Vercel). */
export function defaultLocalDatabasePath(): string {
  const bundled = path.resolve(process.cwd(), BUNDLED_DATABASE_REL);
  if (canWriteDir(path.dirname(bundled))) return bundled;
  return path.join(os.tmpdir(), "tradepal.db");
}

function fileUrlFor(absPath: string): string {
  const unix = absPath.replace(/\\/g, "/");
  return unix.startsWith("/") ? `file:${unix}` : `file:/${unix}`;
}

export function databaseUrl(): string {
  const url = envUrl();
  if (url && isRemoteDatabaseUrl(url)) return url;
  if (url.startsWith("file:")) {
    const requested = localDatabasePath(url);
    if (requested && canWriteDir(path.dirname(requested))) return url;
    return fileUrlFor(defaultLocalDatabasePath());
  }
  const local = defaultLocalDatabasePath();
  const bundled = path.resolve(process.cwd(), BUNDLED_DATABASE_REL);
  if (path.resolve(local) === path.resolve(bundled)) return DEFAULT_DATABASE_URL;
  return fileUrlFor(local);
}

/** Path of a local SQLite database, or null when using a remote libSQL/Turso database. */
export function localDatabasePath(url = databaseUrl()): string | null {
  if (!url.startsWith("file:")) return null;
  let rest = url.slice("file:".length);
  if (rest.startsWith("///")) rest = rest.slice(3);
  else if (rest.startsWith("//")) rest = rest.slice(2);
  rest = rest.replace(/^\/([A-Za-z]:)/, "$1");
  return path.resolve(process.cwd(), rest);
}

export function bundledDatabasePath(): string {
  return path.resolve(process.cwd(), BUNDLED_DATABASE_REL);
}

/** Copies the build-time seed database into a writable location when needed. */
export function hydrateLocalDatabase(url = databaseUrl()): void {
  const local = localDatabasePath(url);
  if (!local) return;
  mkdirSync(path.dirname(local), { recursive: true });
  if (existsSync(local)) return;
  const bundled = bundledDatabasePath();
  if (!existsSync(bundled) || path.resolve(local) === path.resolve(bundled)) return;
  copyFileSync(bundled, local);
  for (const extra of ["-wal", "-shm"]) {
    if (existsSync(bundled + extra)) copyFileSync(bundled + extra, local + extra);
  }
}

export function createDb(url = databaseUrl()): { db: Db; client: Client } {
  const remote = isRemoteDatabaseUrl(url);
  if (!remote) hydrateLocalDatabase(url);
  const client = remote
    ? createWebClient({ url, authToken: databaseAuthToken() })
    : createNodeClient({ url, authToken: databaseAuthToken() });
  return { db: drizzle(client, { schema }), client };
}
