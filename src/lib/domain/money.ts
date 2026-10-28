/** All money in Tradepal is held as integer pence. Rates are held in basis points (1% = 100 bps). */

export const VAT_STANDARD_BPS = 2000;

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

export function formatGBP(pence: number): string {
  return gbp.format(pence / 100);
}

export function poundsToPence(pounds: number): number {
  return Math.round(pounds * 100);
}

export function penceToPounds(pence: number): number {
  return pence / 100;
}

export function applyBps(amount: number, bps: number): number {
  return Math.round((amount * bps) / 10000);
}

export function formatBps(bps: number): string {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct.toFixed(0) : pct.toFixed(1)}%`;
}

export function parsePoundsInput(value: FormDataEntryValue | null | undefined): number | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[£,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return poundsToPence(n);
}
