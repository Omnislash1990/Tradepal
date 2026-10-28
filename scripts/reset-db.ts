import "./env";
import { existsSync, rmSync } from "node:fs";
import { localDatabasePath } from "@/lib/db/client";

async function main() {
  const file = localDatabasePath();
  if (!file) {
    console.error("db:reset only works with a local SQLite database. Refusing to wipe a remote database.");
    process.exit(1);
  }
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    if (existsSync(file + suffix)) rmSync(file + suffix);
  }
  console.log(`Removed ${file}`);
  const { prepareDatabase } = await import("./prepare-db");
  await prepareDatabase({ seed: true });
}

main().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
