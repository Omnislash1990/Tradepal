export type DeliveryClass = "parcel" | "standard" | "heavy";

export const DELIVERY_CLASSES: DeliveryClass[] = ["parcel", "standard", "heavy"];

export const DELIVERY_CLASS_LABEL: Record<DeliveryClass, string> = {
  parcel: "Parcel delivery",
  standard: "Van delivery",
  heavy: "Heavy goods (flatbed) delivery",
};

export const DELIVERY_CLASS_HINT: Record<DeliveryClass, string> = {
  parcel: "Small items delivered by courier.",
  standard: "Delivered by van to your door.",
  heavy: "Delivered kerbside by flatbed lorry. Someone should be available to receive it.",
};

const ORDER: Record<DeliveryClass, number> = { parcel: 0, standard: 1, heavy: 2 };

export function maxDeliveryClass(classes: DeliveryClass[]): DeliveryClass {
  return classes.reduce<DeliveryClass>((max, c) => (ORDER[c] > ORDER[max] ? c : max), "parcel");
}

export type ZoneRate = { chargeGross: number; freeOverGross: number | null };
export type ZoneRates = Record<DeliveryClass, ZoneRate>;

export function customerDeliveryCharge(
  rates: ZoneRates,
  deliveryClass: DeliveryClass,
  goodsGross: number,
): { chargeGross: number; isFree: boolean; freeOverGross: number | null } {
  const rate = rates[deliveryClass];
  const isFree = rate.freeOverGross != null && goodsGross >= rate.freeOverGross;
  return { chargeGross: isFree ? 0 : rate.chargeGross, isFree, freeOverGross: rate.freeOverGross };
}

/** What the supplier charges Tradepal to deliver a shipment (net of VAT). */
export type SupplierDeliveryCosts = Record<DeliveryClass, number> & { freeOverNet: number | null };

export function supplierDeliveryCost(
  costs: SupplierDeliveryCosts,
  deliveryClass: DeliveryClass,
  goodsCostNet: number,
): number {
  if (costs.freeOverNet != null && goodsCostNet >= costs.freeOverNet) return 0;
  return costs[deliveryClass];
}

/** England & Wales bank holidays, used when estimating delivery dates. Editable in admin settings. */
export const DEFAULT_BANK_HOLIDAYS = [
  "2026-01-01", "2026-04-03", "2026-04-06", "2026-05-04", "2026-05-25", "2026-08-31",
  "2026-12-25", "2026-12-28",
  "2027-01-01", "2027-03-26", "2027-03-29", "2027-05-03", "2027-05-31", "2027-08-30",
  "2027-12-27", "2027-12-28",
];

const londonFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

export function londonNow(now: Date): { isoDate: string; hour: number } {
  const parts = Object.fromEntries(londonFormatter.formatToParts(now).map((p) => [p.type, p.value]));
  return { isoDate: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

function isoToUtcNoon(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

function addDays(iso: string, days: number): string {
  const d = isoToUtcNoon(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isWorkingDay(iso: string, opts: { saturday: boolean; holidays: Set<string> }): boolean {
  const dow = isoToUtcNoon(iso).getUTCDay();
  if (dow === 0) return false;
  if (dow === 6 && !opts.saturday) return false;
  return !opts.holidays.has(iso);
}

export function addWorkingDays(
  iso: string,
  days: number,
  opts: { saturday: boolean; holidays: Set<string> },
): string {
  let current = iso;
  let remaining = days;
  while (remaining > 0) {
    current = addDays(current, 1);
    if (isWorkingDay(current, opts)) remaining--;
  }
  return current;
}

/**
 * Orders placed after the supplier's cut-off, or on a non-working day, start processing on the next
 * working day. Delivery is then `leadDays` working days after processing starts.
 */
export function estimateDeliveryDate(
  now: Date,
  opts: { leadDays: number; cutoffHour: number; saturday: boolean; holidays: string[]; extraDays?: number },
): string {
  const holidays = new Set(opts.holidays);
  const processingOpts = { saturday: false, holidays };
  const { isoDate, hour } = londonNow(now);
  let start = isoDate;
  if (!isWorkingDay(start, processingOpts) || hour >= opts.cutoffHour) {
    start = addWorkingDays(start, 1, processingOpts);
  }
  const total = Math.max(1, opts.leadDays + (opts.extraDays ?? 0));
  return addWorkingDays(start, total, { saturday: opts.saturday, holidays });
}

const displayDate = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function formatDeliveryDate(iso: string): string {
  return displayDate.format(isoToUtcNoon(iso));
}
