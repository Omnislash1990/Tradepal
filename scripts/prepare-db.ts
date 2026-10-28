import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "@/lib/db";
import { localDatabasePath } from "@/lib/db/client";
import { DEMO_ACCOUNTS, isSeeded, seedDatabase } from "@/lib/server/seed";

export async function prepareDatabase({ seed }: { seed: boolean }): Promise<void> {
  if (localDatabasePath()) await db.run(sql`PRAGMA journal_mode = WAL`);
  await migrate(db, { migrationsFolder: "drizzle" });
  if (!seed || (await isSeeded())) return;
  const started = Date.now();
  console.log("Seeding sample data…");
  await seedDatabase((msg) => console.log(msg));
  console.log(`Sample data ready in ${((Date.now() - started) / 1000).toFixed(1)}s. Demo sign-ins:`);
  for (const [role, account] of Object.entries(DEMO_ACCOUNTS)) {
    console.log(`  ${role.padEnd(8)} ${account.email.padEnd(24)} ${account.password}`);
  }
}
