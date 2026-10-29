import "server-only";
import { createDb, type Db } from "./client";

const globalForDb = globalThis as unknown as {
  __tradepalDb?: Db;
  __tradepalReady?: Promise<void>;
};

export const db: Db = globalForDb.__tradepalDb ?? createDb().db;
globalForDb.__tradepalDb = db;

/** Creates tables and sample catalogue if this process does not already have them. */
export async function ensureDatabase(): Promise<void> {
  if (!globalForDb.__tradepalReady) {
    globalForDb.__tradepalReady = import("./prepare")
      .then(({ prepareDatabase }) => prepareDatabase({ seed: process.env.SEED_SAMPLE_DATA !== "false" }))
      .catch((err: unknown) => {
        globalForDb.__tradepalReady = undefined;
        throw err;
      });
  }
  await globalForDb.__tradepalReady;
}

export * as t from "./schema";
