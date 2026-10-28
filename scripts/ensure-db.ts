import "./env";
import { prepareDatabase } from "./prepare-db";

prepareDatabase({ seed: process.env.SEED_SAMPLE_DATA !== "false" }).catch((err) => {
  console.error("Database setup failed:", err);
  process.exit(1);
});
