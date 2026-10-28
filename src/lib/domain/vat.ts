/**
 * Selling prices are stored VAT-inclusive (what a retail customer pays). Net and VAT
 * figures are derived from gross totals per VAT rate, so a basket total always equals
 * the sum of the prices the customer saw.
 */

export function netFromGross(gross: number, vatBps: number): number {
  return Math.round((gross * 10000) / (10000 + vatBps));
}

export function grossFromNet(net: number, vatBps: number): number {
  return Math.round((net * (10000 + vatBps)) / 10000);
}

export function vatInGross(gross: number, vatBps: number): number {
  return gross - netFromGross(gross, vatBps);
}

export type VatLine = { gross: number; vatBps: number };

export type VatSummary = {
  gross: number;
  net: number;
  vat: number;
  byRate: { vatBps: number; gross: number; net: number; vat: number }[];
};

export function summariseVat(lines: VatLine[]): VatSummary {
  const groups = new Map<number, number>();
  for (const line of lines) {
    groups.set(line.vatBps, (groups.get(line.vatBps) ?? 0) + line.gross);
  }
  const byRate = [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([vatBps, gross]) => {
      const net = netFromGross(gross, vatBps);
      return { vatBps, gross, net, vat: gross - net };
    });
  return {
    gross: byRate.reduce((s, r) => s + r.gross, 0),
    net: byRate.reduce((s, r) => s + r.net, 0),
    vat: byRate.reduce((s, r) => s + r.vat, 0),
    byRate,
  };
}
