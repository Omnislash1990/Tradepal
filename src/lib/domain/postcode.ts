export type ParsedPostcode = {
  outward: string;
  inward: string | null;
  /** Letters at the start of the outward code, e.g. "B", "WS". */
  area: string;
  formatted: string;
  isFull: boolean;
};

const OUTWARD_RE = /^[A-Z]{1,2}\d[A-Z\d]?$/;
const INWARD_RE = /^\d[A-Z]{2}$/;

/** Accepts a full UK postcode ("b15 2tt") or just the outward code ("B15"). */
export function parsePostcode(raw: string | null | undefined): ParsedPostcode | null {
  if (!raw) return null;
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.length < 2 || s.length > 7) return null;

  if (s.length >= 5) {
    const outward = s.slice(0, -3);
    const inward = s.slice(-3);
    if (OUTWARD_RE.test(outward) && INWARD_RE.test(inward)) {
      return {
        outward,
        inward,
        area: outward.match(/^[A-Z]+/)![0],
        formatted: `${outward} ${inward}`,
        isFull: true,
      };
    }
  }
  if (OUTWARD_RE.test(s)) {
    return { outward: s, inward: null, area: s.match(/^[A-Z]+/)![0], formatted: s, isFull: false };
  }
  return null;
}

export type ZoneLike = { id: string; postcodePrefixes: string[]; active: boolean };

/**
 * Prefixes containing a digit match a whole outward code ("WS10"); letter-only prefixes match a
 * postcode area ("B" matches B15 but not BA1). District matches beat area matches.
 */
export function findZone<Z extends ZoneLike>(postcode: ParsedPostcode, zones: Z[]): Z | null {
  let best: { zone: Z; specificity: number } | null = null;
  for (const zone of zones) {
    for (const rawPrefix of zone.postcodePrefixes) {
      const prefix = rawPrefix.toUpperCase().replace(/\s/g, "");
      const isDistrict = /\d/.test(prefix);
      const matches = isDistrict ? postcode.outward === prefix : postcode.area === prefix;
      if (!matches) continue;
      const specificity = isDistrict ? 2 : 1;
      if (!best || specificity > best.specificity) best = { zone, specificity };
    }
  }
  return best?.zone ?? null;
}
