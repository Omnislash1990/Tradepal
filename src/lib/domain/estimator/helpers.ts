import type { Confidence, Estimate, EstimateGroup, EstimateLine, JobType, MaterialLookup } from "./types";

/** Rounds up, ignoring floating-point noise such as 3.0000000004. */
export function ceilQty(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.ceil(Number(n.toFixed(6)));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function fmtNum(n: number, dp = 2): string {
  return Number(n.toFixed(dp)).toLocaleString("en-GB", { maximumFractionDigits: dp });
}

export const fmtM = (n: number) => `${fmtNum(n)} m`;
export const fmtM2 = (n: number) => `${fmtNum(n)} m²`;
export const fmtM3 = (n: number) => `${fmtNum(n, 3)} m³`;

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${fmtNum(n)} ${n === 1 ? one : many}`;
}

export class LineBuilder {
  readonly lines: EstimateLine[] = [];

  constructor(private readonly lookup: MaterialLookup) {}

  add(sku: string, quantity: number, reason: string, group: EstimateGroup, optional = false): this {
    if (quantity <= 0) return this;
    const product = this.lookup(sku);
    this.lines.push({
      sku,
      name: product?.name ?? sku,
      quantity,
      unitGross: product?.unitGross ?? 0,
      reason,
      group,
      optional,
      available: product?.available ?? false,
    });
    return this;
  }

  attr(sku: string) {
    return this.lookup(sku)?.attributes ?? {};
  }
}

export function finishEstimate(input: {
  jobType: JobType;
  title: string;
  summary: string;
  measurements: { label: string; value: string }[];
  assumptions: string[];
  warnings: string[];
  lines: EstimateLine[];
  confidence: Confidence;
}): Estimate {
  const unavailable = input.lines.filter((l) => !l.available && !l.optional);
  const warnings = [...input.warnings];
  if (unavailable.length > 0) {
    warnings.push(
      `${unavailable.map((l) => l.name).join(", ")} ${unavailable.length === 1 ? "is" : "are"} currently unavailable — see the product page for suitable alternatives.`,
    );
  }
  return {
    ...input,
    warnings,
    totalGross: input.lines.filter((l) => !l.optional).reduce((s, l) => s + l.unitGross * l.quantity, 0),
  };
}

/** Cheapest combination of tin sizes that provides at least `litresNeeded`. */
export function chooseTins(
  litresNeeded: number,
  tins: { sku: string; litres: number; price: number }[],
): { sku: string; litres: number; count: number }[] {
  if (litresNeeded <= 0 || tins.length === 0) return [];
  const sorted = [...tins].sort((a, b) => b.litres - a.litres);
  const maxCounts = sorted.map((t, i) => (i === 0 ? Math.ceil(litresNeeded / t.litres) + 1 : 3));
  let best: { counts: number[]; price: number; litres: number } | null = null;
  const counts = new Array(sorted.length).fill(0);
  const search = (i: number) => {
    if (i === sorted.length) {
      const litres = counts.reduce((s, c, k) => s + c * sorted[k].litres, 0);
      if (litres + 1e-9 < litresNeeded) return;
      const price = counts.reduce((s, c, k) => s + c * sorted[k].price, 0);
      if (!best || price < best.price || (price === best.price && litres < best.litres)) {
        best = { counts: [...counts], price, litres };
      }
      return;
    }
    for (let c = 0; c <= maxCounts[i]; c++) {
      counts[i] = c;
      search(i + 1);
    }
    counts[i] = 0;
  };
  search(0);
  const chosen = best as { counts: number[] } | null;
  if (!chosen) return [];
  return sorted
    .map((t, k) => ({ sku: t.sku, litres: t.litres, count: chosen.counts[k] }))
    .filter((t) => t.count > 0);
}
