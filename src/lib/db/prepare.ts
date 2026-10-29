import path from "node:path";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "@/lib/db";
import { isRemoteDatabaseUrl, localDatabasePath, databaseUrl } from "@/lib/db/client";
import { DEMO_ACCOUNTS, isSeeded, seedDatabase } from "@/lib/server/seed";

export async function prepareDatabase({ seed }: { seed: boolean }): Promise<void> {
  const local = localDatabasePath();
  if (local) {
    await db.run(sql`PRAGMA busy_timeout = 5000`);
    await db.run(sql`PRAGMA journal_mode = DELETE`);
  }
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  await migrate(db, { migrationsFolder });
  if (!seed || (await isSeeded())) {
    if (local) await db.run(sql`PRAGMA wal_checkpoint(TRUNCATE)`);
    return;
  }
  if (isRemoteDatabaseUrl(databaseUrl())) {
    console.log("Seeding hosted database…");
  } else {
    console.log("Seeding sample data…");
  }
  const started = Date.now();
  await seedDatabase((msg) => console.log(msg));
  if (local) await db.run(sql`PRAGMA wal_checkpoint(TRUNCATE)`);
  console.log(`Sample data ready in ${((Date.now() - started) / 1000).toFixed(1)}s. Demo sign-ins:`);
  for (const [role, account] of Object.entries(DEMO_ACCOUNTS)) {
    console.log(`  ${role.padEnd(8)} ${account.email.padEnd(24)} ${account.password}`);
  }
}
