import { detectIntent, hasMeasurement, normalise } from "./assistant/parser";
import type { JobType } from "./estimator/types";

export type SearchDoc = {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  categoryName: string;
  tags: string[];
  description: string;
  popularity: number;
};

const STOPWORDS = new Set(
  "a an and any are as at be best buy can cheap cheapest do does for from get good got have help i im in is it its looking me my need needs of on or please some something that the them these this to use used want what where which with would you your mm cm m kg l ml ft x".split(
    " ",
  ),
);

/** Trade jargon and everyday descriptions mapped onto catalogue vocabulary. */
const SYNONYMS: [RegExp, string[]][] = [
  [/\b(drywall|sheetrock|gyproc|gypsum|plaster ?boards?)\b/, ["plasterboard"]],
  [/\b(fill(?:ing)? (?:in )?(?:holes|cracks)|holes? in (?:the |my )?walls?|polyfill\w*|cracks?)\b/, ["filler"]],
  [/\b(no ?more ?nails|no ?nails|grab adhesive|glue)\b/, ["grab", "adhesive"]],
  [/\b(mastic|seal(?:ant)? around|silicone)\b/, ["sealant", "silicone"]],
  [/\b(2 ?x ?4|4 ?x ?2|two by four|studs?|studwork|stud wall)\b/, ["cls", "studwork"]],
  [/\b(lumber|planks?|wood)\b/, ["timber"]],
  [/\b(wiring|wire|electric(?:al)? cable|t ?(?:&|and) ?e|twin and earth)\b/, ["cable", "twin", "earth"]],
  [/\b(plug sockets?|power points?|outlets?)\b/, ["socket"]],
  [/\b(loo|wc|lavatory)\b/, ["toilet"]],
  [/\b(rads?)\b/, ["radiator"]],
  [/\b(postcrete|post ?mix|post concrete)\b/, ["post", "concrete", "mix"]],
  [/\b(flags|flagstones?|paving)\b/, ["paving", "slab"]],
  [/\b(skim(?:ming)?|finishing plaster|multi ?finish)\b/, ["multi-finish"]],
  [/\b(gravel|hardcore|type ?1|sub ?base|aggregate)\b/, ["mot", "sub-base"]],
  [/\b(insulate|lagging)\b/, ["insulation"]],
  [/\b(spot ?lights?|downlighters?|ceiling lights?)\b/, ["downlight"]],
  [/\b(fuse ?box|fuse ?board|consumer unit)\b/, ["consumer"]],
  [/\b(drill|driver|cordless)\b/, ["drill"]],
  [/\b(emulsion|paint)\b/, ["emulsion"]],
  [/\b(sink|wash ?basin|hand ?basin)\b/, ["basin"]],
  [/\b(laminate|floating floor|wood effect floor)\b/, ["laminate"]],
  [/\b(sterling ?board|chipboard)\b/, ["osb"]],
  [/\b(ply)\b/, ["plywood"]],
  [/\b(breeze ?blocks?|blockwork)\b/, ["block"]],
  [/\b(sink waste|waste pipe|drain pipe)\b/, ["waste"]],
  [/\b(shed base|concrete mix|concrete)\b/, ["cement", "ballast"]],
  [/\b(spirit level)\b/, ["level"]],
  [/\b(tape measure|measuring tape)\b/, ["tape", "measure"]],
  [/\b(stanley knife|craft knife)\b/, ["utility", "knife"]],
];

function stem(token: string): string {
  if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 3 && token.endsWith("es") && /(?:ch|sh|x|ss)es$/.test(token)) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9. ]+/g, " ")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .split(/\s+/)
    .map((t) => t.replace(/^\.+|\.+$/g, ""))
    .filter(Boolean)
    .map(stem);
}

function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else if (a[i + 1] === b[j] && a[i] === b[j + 1]) {
      i += 2;
      j += 2;
    } else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

export type ParsedQuery = { raw: string; tokens: string[]; expanded: string[] };

export function parseQuery(raw: string): ParsedQuery {
  const lower = raw.toLowerCase();
  const tokens = tokenize(lower).filter((t) => !STOPWORDS.has(t));
  const expanded: string[] = [];
  for (const [re, words] of SYNONYMS) {
    if (re.test(lower)) expanded.push(...words.flatMap(tokenize));
  }
  return { raw, tokens: [...new Set(tokens)], expanded: [...new Set(expanded)].filter((w) => !tokens.includes(w)) };
}

export type PreparedDoc = SearchDoc & {
  nameT: Set<string>;
  tagT: Set<string>;
  catT: Set<string>;
  descT: Set<string>;
  skuT: Set<string>;
};

export function prepareDocs(docs: SearchDoc[]): PreparedDoc[] {
  return docs.map((d) => ({
    ...d,
    nameT: new Set(tokenize(`${d.name} ${d.brand ?? ""}`)),
    tagT: new Set(d.tags.flatMap(tokenize)),
    catT: new Set(tokenize(d.categoryName)),
    descT: new Set(tokenize(d.description)),
    skuT: new Set(d.sku.toLowerCase().split("-")),
  }));
}

function tokenScore(doc: PreparedDoc, token: string): number {
  if (doc.nameT.has(token)) return 10;
  if (doc.tagT.has(token)) return 8;
  if (doc.skuT.has(token) && token.length >= 2) return 6;
  if (token.length >= 3) {
    for (const t of doc.nameT) if (t.startsWith(token)) return 6;
    for (const t of doc.tagT) if (t.startsWith(token)) return 5;
  }
  if (doc.catT.has(token)) return 4;
  if (token.length >= 5) {
    for (const t of doc.nameT) if (withinOneEdit(t, token)) return 5;
    for (const t of doc.tagT) if (withinOneEdit(t, token)) return 4;
  }
  if (doc.descT.has(token)) return 2;
  return 0;
}

export function searchDocs(docs: PreparedDoc[], raw: string, limit = 48): { doc: SearchDoc; score: number }[] {
  const q = parseQuery(raw);
  const skuMatch = docs.find((d) => d.sku.toLowerCase() === raw.trim().toLowerCase());
  if (skuMatch) return [{ doc: skuMatch, score: 1000 }];
  if (q.tokens.length === 0 && q.expanded.length === 0) return [];

  const results: { doc: SearchDoc; score: number }[] = [];
  for (const doc of docs) {
    let score = 0;
    let matched = 0;
    for (const token of q.tokens) {
      const s = tokenScore(doc, token);
      if (s > 0) matched++;
      score += s;
    }
    let synonymHits = 0;
    for (const token of q.expanded) {
      const s = tokenScore(doc, token);
      if (s > 0) synonymHits++;
      score += s * 0.9;
    }
    if (score === 0) continue;
    const coverage = q.tokens.length ? matched / q.tokens.length : 0;
    // Require most of the customer's words (or a jargon match) to appear, so results stay relevant.
    if (q.tokens.length > 0 && coverage < 0.5 && synonymHits === 0) continue;
    results.push({ doc, score: score * (0.6 + coverage) + doc.popularity * 0.02 });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Recognises job descriptions ("tile my bathroom floor") so search can offer the estimator. */
export function detectJobInQuery(raw: string): JobType | null {
  return detectIntent(normalise(raw));
}

export function queryHasMeasurements(raw: string): boolean {
  return hasMeasurement(normalise(raw));
}
