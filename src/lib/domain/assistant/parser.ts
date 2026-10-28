import type { JobInputs, JobOptions, JobType } from "../estimator/types";

type Unit = "m" | "cm" | "mm" | "ft" | "in";

const NUMBER_WORDS: Record<string, number> = {
  no: 0, zero: 0, a: 1, an: 1, one: 1, single: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30,
};
const COUNT = String.raw`(\d+|no|zero|a|an|one|single|two|three|four|five|six|seven|eight|nine|ten)`;
const NUM = String.raw`(\d+(?:\.\d+)?)`;
const UNIT = String.raw`(mm|cm|m|ft|in)?`;

export function normalise(text: string): string {
  const s = text
    .toLowerCase()
    .replace(/²/g, "2")
    .replace(/[×✕]/g, " x ")
    .replace(/(\d),(\d{3})\b/g, "$1$2")
    .replace(/(\d)\s*(?:m2|sq\.?\s*m(?:etres?|eters?)?|sqm|square\s*m(?:etres?|eters?)?)(?![a-z])/g, "$1sqm ")
    .replace(/(\d)\s*(?:sq\.?\s*f(?:ee|oo)?t|sqft|square\s*f(?:ee|oo)t)(?![a-z])/g, "$1sqft ")
    .replace(/(\d)\s*(?:millimetres?|millimeters?|mm)(?![a-z])/g, "$1mm ")
    .replace(/(\d)\s*(?:centimetres?|centimeters?|cm)(?![a-z])/g, "$1cm ")
    .replace(/(\d)\s*(?:metres?|meters?|mtrs?|m)(?![a-z0-9])/g, "$1m ")
    .replace(/(\d)\s*(?:feet|foot|ft|')(?![a-z])/g, "$1ft ")
    .replace(/(\d)(?:\s*(?:inches|inch|")|in(?![a-z]))/g, "$1in ")
    .replace(/[,;!?()]/g, " ")
    .replace(/\s+/g, " ");
  return ` ${s.trim()} `;
}

function toCount(word: string | undefined): number {
  if (!word) return 0;
  return /^\d+$/.test(word) ? Number(word) : (NUMBER_WORDS[word] ?? 0);
}

/** Bare numbers without units: small values are metres, mid-range centimetres, large millimetres. */
function guessUnit(value: number): Unit {
  if (value <= 30) return "m";
  if (value <= 400) return "cm";
  return "mm";
}

export function toMetres(value: number, unit: Unit): number {
  switch (unit) {
    case "m": return value;
    case "cm": return value / 100;
    case "mm": return value / 1000;
    case "ft": return value * 0.3048;
    case "in": return value * 0.0254;
  }
}

const ROOMS = String.raw`(?:wall|walls|ceiling|room|bedroom|kitchen|bathroom|lounge|living room|dining room|hallway|landing|garage|loft|extension|office|nursery|utility|en ?suite|house|flat)`;
const DET = String.raw`(?:a |an |the |my |this |our |some |new |out |over |up |around |behind )*`;

/**
 * `strong` phrases describe a job on their own ("tile the bathroom floor"). `noun` matches only count when the
 * message also has measurements or asks how much is needed, so "screws for plasterboard" stays a product search.
 */
const INTENTS: { type: JobType; strong: RegExp; noun: RegExp }[] = [
  {
    type: "loft-insulation",
    strong: /\binsulat\w* (?:the |my |our |a )?loft|\bloft (?:insulation|floor)\b|\btop(?:ping)? up (?:the |my |our )?loft/,
    noun: /\bloft\b/,
  },
  {
    type: "stud-wall",
    strong: /stud ?(?:wall|work|partition)|\bpartition\b|\b(?:build|put up|frame)(?:ing)? (?:a |an )?(?:new |internal |stud |partition )?wall|divide (?:a |the |my )?room/,
    noun: /\bstuds?\b/,
  },
  {
    type: "plasterboard",
    strong: new RegExp(
      String.raw`\b(?:plaster ?board|dry ?line|board|re-?board)(?:ing|ed)? ${DET}${ROOMS}|\bdry ?lining\b|\b(?:to|need to|want to|going to) (?:plaster ?board|dry ?line)\b`,
    ),
    noun: /plaster ?board|drywall/,
  },
  {
    type: "skim",
    strong: new RegExp(String.raw`\bskim(?:ming|med)? ${DET}${ROOMS}|\bre-?plaster|\bplaster(?:ing)? ${DET}${ROOMS}|\bto (?:skim|plaster)\b`),
    noun: /\bskim|multi ?finish/,
  },
  {
    type: "tile",
    strong: new RegExp(String.raw`\btil(?:e|ing) ${DET}(?:${ROOMS}|floor|shower|splash ?back)|\bsplash ?back\b|\b(?:to|need to|want to|going to) (?:re-?)?tile\b|\bre-?til`),
    noun: /\btil(?:e|es|ed|ing)\b/,
  },
  {
    type: "flooring",
    strong: new RegExp(String.raw`\blay(?:ing)? (?:some |new )?(?:laminate|flooring|wood(?:en)? floor)|\blaminate ${DET}(?:${ROOMS}|floor)`),
    noun: /\blaminate|\bflooring\b|wood(?:en)? floor/,
  },
  {
    type: "paint",
    strong: new RegExp(String.raw`\b(?:paint|decorat\w*)(?:ing)? ${DET}(?:\w+ )?${ROOMS}|\b(?:to|need to|want to|going to) (?:paint|decorate)\b|\bredecorat`),
    noun: /\bpaint|emulsion|magnolia/,
  },
  {
    type: "fence",
    strong: /\b(?:put(?:ting)? up|erect|build|replace|install)(?:ing)? (?:a |an |the |my |some |new )*(?:\w+ )?fenc|\bfenc(?:e|ing) (?:run|line)\b/,
    noun: /\bfenc/,
  },
  {
    type: "patio",
    strong: /\b(?:lay|build|put down|install)(?:ing)? (?:a |an |the |my |some |new )*patio|\bpatio (?:area|base)\b|\bpave (?:the |my |a )?(?:garden|yard|area)/,
    noun: /\bpatio|paving|\bslabs?\b/,
  },
  {
    type: "concrete-base",
    strong: /concrete (?:base|slab|pad)|shed base|base for (?:a |my |the )?(?:shed|summer ?house|garage|hot tub|greenhouse|cabin)|(?:lay|pour)(?:ing)? (?:a |some )?concrete/,
    noun: /\bconcrete\b/,
  },
];

const QUANTITY_CUE = /\bhow (?:much|many)\b|\b(?:do|will|would) i need\b|\bestimate\b|\bcalculat|\bwork out\b|\bquantit/;

export function hasMeasurement(normalised: string): boolean {
  return /\d(?:\.\d+)?\s*(?:m|mm|cm|ft|in|sqm|sqft)\b|\d\s*(?:x|by)\s*\d/.test(normalised);
}

function earliest(normalised: string, pick: (i: (typeof INTENTS)[number]) => RegExp): JobType | null {
  let best: { type: JobType; index: number } | null = null;
  for (const intent of INTENTS) {
    const m = pick(intent).exec(normalised);
    if (m && (!best || m.index < best.index)) best = { type: intent.type, index: m.index };
  }
  return best?.type ?? null;
}

/** Picks the job mentioned earliest, so "paint the new plasterboard" reads as painting. */
export function detectIntent(normalised: string): JobType | null {
  const strong = earliest(normalised, (i) => i.strong);
  if (strong) return strong;
  if (hasMeasurement(normalised) || QUANTITY_CUE.test(normalised)) return earliest(normalised, (i) => i.noun);
  return null;
}

export type ParsedDetails = {
  areaM2?: number;
  /** Dimensions given as "a x b (x c)", converted to metres, in the order written. */
  multi?: number[];
  multiThirdUnit?: Unit;
  labelled: { length?: number; width?: number; height?: number; depthMm?: number; run?: number };
  /** Stand-alone measurements, in metres. */
  bare: number[];
  doors?: number;
  windows?: number;
  options: JobOptions;
};

export function parseDetails(normalised: string, jobType: JobType | null): ParsedDetails {
  let s = normalised;
  const out: ParsedDetails = { labelled: {}, bare: [], options: {} };
  /** Runs `fn` on every match and removes the match from the text, unless `fn` returns false. */
  const take = (re: RegExp, fn: (m: (string | undefined)[]) => void | false) => {
    s = s.replace(re, (...args) => {
      const groups = args.slice(0, -2) as (string | undefined)[];
      return fn(groups) === false ? (groups[0] ?? "") : " ";
    });
  };

  // Tile sizes such as 300x600 or 600 x 600mm tiles.
  take(/(?<!\d)(\d{3})\s*(?:mm)?\s*x\s*(\d{3})(?!\d)\s*(?:mm)?/g, (m) => {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const key = [Math.min(a, b), Math.max(a, b)].join("x");
    if (key !== "300x600" && key !== "100x200" && key !== "600x600") return false;
    out.options.tileSize = key;
  });
  if (/\bmetro\b/.test(s)) out.options.tileSize = "100x200";

  take(new RegExp(`${NUM}\\s*sqm`, "g"), (m) => {
    out.areaM2 = Number(m[1]);
  });
  take(new RegExp(`${NUM}\\s*sqft`, "g"), (m) => {
    out.areaM2 = Number(m[1]) * 0.092903;
  });

  take(new RegExp(`\\b${COUNT}\\s+(?:(?:internal|external|front|back|new)\\s+)?(?:doors?|doorways?)`, "g"), (m) => {
    out.doors = toCount(m[1]);
  });
  take(new RegExp(`\\b${COUNT}\\s+(?:(?:small|large|big)\\s+)?windows?`, "g"), (m) => {
    out.windows = toCount(m[1]);
  });
  take(/(\d)\s*coats?/g, (m) => {
    out.options.coats = Number(m[1]);
  });
  take(/\b(one|two|three|four)\s+coats?/g, (m) => {
    out.options.coats = toCount(m[1]);
  });
  take(/(\d{1,2})\s*(?:%|percent)(?:\s*(?:waste|extra|allowance))?/g, (m) => {
    out.options.wastePct = Number(m[1]);
  });

  // Stud sizes.
  take(/\b(63|89)\s*mm\s*(?:cls|studs?|timber)?/g, (m) => {
    out.options.studSize = Number(m[1]) as 63 | 89;
  });
  take(/\b(3|4)\s*in\s*(?:cls|studs?|timber)/g, (m) => {
    out.options.studSize = m[1] === "4" ? 89 : 63;
  });

  // Loft: existing insulation depth.
  if (jobType === "loft-insulation") {
    take(/(\d{2,3})\s*mm(?:\s*(?:or more|of insulation|insulation|already|existing|there))?/g, (m) => {
      out.options.existingInsulationMm = Number(m[1]);
    });
    if (/\b(none|no (?:existing )?insulation|nothing|empty|bare)\b/.test(s)) out.options.existingInsulationMm = 0;
  }

  // Fence panel heights are options, not dimensions.
  if (jobType === "fence" || /\bfenc/.test(s)) {
    take(/\b(5|6)\s*ft\b(?:\s*(?:high|tall|panels?|fenc\w*))?|\b(five|six) (?:foot|ft)\b/g, (m) => {
      out.options.panelHeight = m[1] === "5" || m[2] === "five" ? "5ft" : "6ft";
    });
    take(/\b1\.8\d?\s*m\s*(?:high|tall)\b/g, () => {
      out.options.panelHeight = "6ft";
    });
  }

  // a x b (x c)
  take(
    new RegExp(`${NUM}\\s*${UNIT}\\s*(?:x|by|\\*)\\s*${NUM}\\s*${UNIT}(?:\\s*(?:x|by|\\*)\\s*${NUM}\\s*${UNIT})?`, "g"),
    (m) => {
      const values = [m[1], m[3], m[5]].filter((v) => v !== undefined && v !== "").map(Number);
      const units = [m[2], m[4], m[6]].slice(0, values.length) as (Unit | undefined)[];
      const lastKnown = [...units].reverse().find(Boolean);
      const resolved = units.map((u, i) => {
        if (u) return u;
        const next = units.slice(i + 1).find(Boolean);
        return next ?? lastKnown ?? guessUnit(values[i]);
      });
      out.multi = values.map((v, i) => toMetres(v, resolved[i]));
      out.multiThirdUnit = values.length === 3 ? resolved[2] : undefined;
    },
  );

  const labelPatterns: { key: keyof ParsedDetails["labelled"]; after: RegExp; before: RegExp }[] = [
    { key: "length", after: /\s*(?:long|in length|length)\b/, before: /\b(?:length|long)(?: of| is|:)?\s*/ },
    { key: "width", after: /\s*(?:wide|in width|width|across)\b/, before: /\b(?:width|wide)(?: of| is|:)?\s*/ },
    { key: "height", after: /\s*(?:high|tall|height|in height|ceilings?)\b/, before: /\b(?:height|high|tall|ceilings? (?:are|is|of)?)(?: of| is|:)?\s*/ },
    { key: "depthMm", after: /\s*(?:deep|thick|depth|thickness)\b/, before: /\b(?:depth|deep|thick|thickness)(?: of| is|:)?\s*/ },
    { key: "run", after: /\s*(?:of )?(?:fenc\w*|run)\b/, before: /\b(?:run|fence)(?: of| is|:)?\s*/ },
  ];
  for (const p of labelPatterns) {
    const assign = (value: number, unit: Unit | undefined) => {
      if (p.key === "depthMm") {
        out.labelled.depthMm = unit ? toMetres(value, unit) * 1000 : value >= 20 ? value : value * 1000;
      } else {
        out.labelled[p.key] = toMetres(value, unit ?? guessUnit(value));
      }
    };
    take(new RegExp(`${NUM}\\s*${UNIT}${p.after.source}`, "g"), (m) => {
      assign(Number(m[1]), m[2] as Unit | undefined);
    });
    take(new RegExp(`${p.before.source}${NUM}\\s*${UNIT}`, "g"), (m) => {
      assign(Number(m[1]), m[2] as Unit | undefined);
    });
  }

  take(new RegExp(`(?<![\\w.])${NUM}\\s*${UNIT}(?![\\w])`, "g"), (m) => {
    const value = Number(m[1]);
    if (value <= 0) return;
    const unit = (m[2] as Unit | undefined) ?? guessUnit(value);
    out.bare.push(toMetres(value, unit));
  });

  parseOptions(normalised, jobType, out.options);
  return out;
}

function parseOptions(s: string, jobType: JobType | null, o: JobOptions) {
  if (/\b(?:no|without|excluding|not the) (?:the )?ceiling|walls only|just the walls|only the walls/.test(s)) o.includeCeiling = false;
  else if (/\b(?:and|plus|including|include|with|inc) (?:the )?ceiling|ceiling (?:too|as well)/.test(s)) o.includeCeiling = true;
  if (/\bnew(?:ly)? plaster|fresh(?:ly)? plaster|bare plaster|new walls|just been plastered/.test(s)) o.newPlaster = true;
  if (/magnolia/.test(s)) o.colour = "magnolia";
  else if (/\bwhite\b/.test(s)) o.colour = "white";

  if (/moisture|bathroom|kitchen|wet ?room|utility|damp|shower/.test(s)) o.boardType = "moisture";
  if (/\bfire\b|fire[- ]?(?:rated|resistant|board)/.test(s)) o.boardType = "fire";
  if (/acoustic|sound ?proof|soundproofing|noise/.test(s)) {
    o.boardType = "acoustic";
    if (jobType === "stud-wall") o.insulation = true;
  }
  if (/\bstandard board|normal board|regular board/.test(s)) o.boardType = "standard";

  if (jobType === "plasterboard" || jobType === null) {
    if (/\bceilings?\b/.test(s) && !/\bwalls?\b/.test(s)) o.surface = "ceiling";
    else if (/\bwalls?\b/.test(s)) o.surface = "wall";
  }
  if (jobType === "tile") {
    if (/\bfloors?\b/.test(s)) o.surface = "floor";
    else if (/\bwalls?\b|splash ?back|backsplash|around the bath|shower walls?/.test(s)) o.surface = "wall";
  }
  if (/diagonal|herringbone/.test(s)) o.layout = "diagonal";
  if (/straight (?:lay|layout|pattern)/.test(s)) o.layout = "straight";

  if (jobType === "stud-wall") {
    if (/\b(?:no|without) insulation/.test(s)) o.insulation = false;
    else if (/insulat/.test(s)) o.insulation = true;
  }
  if (/\b(?:no|without) gravel ?boards?/.test(s)) o.gravelBoards = false;
  else if (/gravel ?boards?/.test(s)) o.gravelBoards = true;
  if (/\b(?:no|without) (?:a )?sub-?base|on (?:existing|old) concrete/.test(s)) o.subBase = false;
  else if (/\bwith (?:a )?sub-?base/.test(s)) o.subBase = true;
}

export function hasAnyDetail(d: ParsedDetails): boolean {
  return (
    d.areaM2 !== undefined ||
    d.multi !== undefined ||
    Object.keys(d.labelled).length > 0 ||
    d.bare.length > 0 ||
    d.doors !== undefined ||
    d.windows !== undefined ||
    Object.keys(d.options).length > 0
  );
}

export type DimensionKey = "lengthM" | "widthM" | "heightM" | "depthMm";

/** Writes parsed measurements onto a job's inputs, following the job's preferred reading order. */
export function applyDetails(
  inputs: JobInputs,
  details: ParsedDetails,
  order: DimensionKey[],
  awaiting: string | null,
  jobType: JobType,
): JobInputs {
  const next: JobInputs = { ...inputs };
  const setDim = (key: DimensionKey, metres: number) => {
    if (key === "depthMm") next.depthMm = Math.round(metres * 1000);
    else next[key] = Math.round(metres * 1000) / 1000;
  };

  if (jobType === "fence") {
    const run = details.labelled.run ?? details.labelled.length ?? details.multi?.[0] ?? details.bare[0];
    if (run) next.runLengthM = Math.round(run * 100) / 100;
  } else {
    if (details.areaM2) {
      next.areaM2 = Math.round(details.areaM2 * 100) / 100;
      if (!details.multi && details.labelled.length === undefined) {
        delete next.lengthM;
        delete next.widthM;
      }
    }
    if (details.multi) {
      const values = [...details.multi];
      const keys = [...order];
      // A third dimension written in mm (e.g. 3m x 2m x 100mm) is a depth.
      if (values.length === 3 && details.multiThirdUnit === "mm" && order.includes("depthMm")) {
        setDim("depthMm", values.pop()!);
        keys.splice(keys.indexOf("depthMm"), 1);
      }
      values.forEach((v, i) => keys[i] && setDim(keys[i], v));
    }
    if (details.labelled.length) setDim("lengthM", details.labelled.length);
    if (details.labelled.width) setDim("widthM", details.labelled.width);
    if (details.labelled.height) setDim("heightM", details.labelled.height);
    if (details.labelled.depthMm) next.depthMm = Math.round(details.labelled.depthMm);
    for (const value of details.bare) {
      const awaitingKey = order.find((k) => k === awaiting);
      const target =
        awaitingKey && next[awaitingKey] === undefined ? awaitingKey : order.find((k) => next[k] === undefined && k !== "depthMm");
      if (target) setDim(target, value);
    }
  }
  if (details.doors !== undefined) next.doors = details.doors;
  if (details.windows !== undefined) next.windows = details.windows;
  return next;
}
