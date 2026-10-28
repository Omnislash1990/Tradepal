import "server-only";
import { createDb, type Db } from "./client";

const globalForDb = globalThis as unknown as { __tradepalDb?: Db };

export const db: Db = globalForDb.__tradepalDb ?? createDb().db;
if (process.env.NODE_ENV !== "production") globalForDb.__tradepalDb = db;

export * as t from "./schema";
