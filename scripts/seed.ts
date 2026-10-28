import "./env";
import { isSeeded } from "@/lib/server/seed";
import { prepareDatabase } from "./prepare-db";

async function main() {
  await prepareDatabase({ seed: false });
  if (await isSeeded()) {
    console.log("The database already has data. Run `npm run db:reset` to start again with fresh sample data.");
    return;
  }
  await prepareDatabase({ seed: true });
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
