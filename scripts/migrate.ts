import "./env";
import { prepareDatabase } from "./prepare-db";

prepareDatabase({ seed: false })
  .then(() => console.log("Migrations applied."))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
