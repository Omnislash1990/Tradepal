import type { AddressSnapshot } from "@/lib/db/schema";

const dateTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/London",
});

const dateOnly = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "Europe/London",
});

export function formatDateTime(value: Date | string | number | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return dateTime.format(d);
}

export function formatDate(value: Date | string | number | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return dateOnly.format(d);
}

export function formatAddress(address: AddressSnapshot, opts: { multiline?: boolean } = {}): string {
  const parts = [address.name, address.line1, address.line2, address.town, address.county, address.postcode].filter(
    (p): p is string => !!p && p.trim().length > 0,
  );
  return opts.multiline ? parts.join("\n") : parts.join(", ");
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}
