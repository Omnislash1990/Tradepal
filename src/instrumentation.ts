export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { ensureDatabase } = await import("@/lib/db");
  await ensureDatabase();
}

export async function onRequestError(error: unknown) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error("[tradepal]", message);
}
