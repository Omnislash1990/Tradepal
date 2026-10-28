import { JOBS, JOB_LIST } from "../estimator/jobs";
import type { Estimate, FieldKey, JobInputs, JobOptions, JobSpec, JobType, MaterialLookup } from "../estimator/types";
import { fmtNum } from "../estimator/helpers";
import { applyDetails, detectIntent, hasAnyDetail, normalise, parseDetails, type DimensionKey } from "./parser";

export type AssistantState = {
  job: JobSpec | null;
  awaiting: FieldKey | null;
};

export const INITIAL_STATE: AssistantState = { job: null, awaiting: null };

export type AssistantReply = {
  text: string;
  quickReplies: string[];
  estimate: Estimate | null;
  /** When set, the server attaches matching catalogue products to the reply. */
  productQuery: string | null;
  action: "add-to-basket" | null;
  intent: JobType | "search" | "help" | "reset" | "add";
};

/** Structured reading of a message, either from the rules below or from an optional language model. */
export type Interpretation = {
  intent: JobType | "search" | "none";
  /** When `merged` is true these are the job's complete inputs; otherwise only what the message changed. */
  inputs: JobInputs;
  merged: boolean;
  options: JobOptions;
  searchQuery: string | null;
};

export const JOB_STARTERS = [
  "Plasterboard a 4.2m x 2.4m wall",
  "Paint a 4m x 3m bedroom",
  "Tile a 2.5m x 2m bathroom floor",
  "20m of 6ft fencing",
  "Build a 3.6m stud wall",
  "Concrete shed base 3m x 2.4m",
];

const JOB_PRODUCT_QUERY: Record<JobType, string> = {
  plasterboard: "plasterboard",
  skim: "multi-finish plaster",
  paint: "emulsion paint",
  tile: "tiles",
  "stud-wall": "cls timber",
  fence: "fence panel",
  "concrete-base": "ballast cement",
  patio: "paving slab",
  flooring: "laminate flooring",
  "loft-insulation": "loft insulation",
};

const REFINEMENTS: Record<JobType, (spec: JobSpec) => string[]> = {
  plasterboard: (s) => [
    s.inputs.doors ? "No doors" : "Add a door",
    s.options.boardType === "moisture" ? "Standard board" : "Moisture-resistant board",
    "15% waste",
  ],
  skim: () => ["Add a window", "15% waste"],
  paint: (s) => [
    s.options.coats === 3 ? "2 coats" : "3 coats",
    s.options.includeCeiling === false ? "Include the ceiling" : "Walls only",
    "It's new plaster",
    s.options.colour === "magnolia" ? "Brilliant white" : "Magnolia walls",
  ],
  tile: (s) => [s.options.layout === "diagonal" ? "Straight layout" : "Diagonal layout", "Metro tiles 100x200", "15% waste"],
  "stud-wall": (s) => [s.options.insulation ? "Without insulation" : "With insulation", s.inputs.doors ? "No doors" : "Add a door", "89mm studs"],
  fence: (s) => [s.options.panelHeight === "5ft" ? "6ft panels" : "5ft panels", s.options.gravelBoards === false ? "With gravel boards" : "No gravel boards"],
  "concrete-base": (s) => ["150mm deep", s.options.subBase === false ? "With a sub-base" : "No sub-base"],
  patio: () => ["Make it 5m x 4m"],
  flooring: () => ["15% waste", "2 doors"],
  "loft-insulation": () => ["Existing 100mm", "No existing insulation"],
};

const RESET_RE = /\b(start (?:again|over)|new job|reset|clear (?:it|this|chat)|something else)\b/;
const HELP_RE = /^\s*(help|what can you do|how does this work|hi|hello|hey)\b/;
const ADD_RE =
  /\b(add (?:it|them|everything|all|these|the lot)(?: to (?:my |the )?basket)?|add (?:all )?to (?:my |the )?basket|put (?:it|them|everything) in (?:my |the )?basket|buy (?:it|them|these|the lot))\b/;

function describeInputs(spec: JobSpec): string {
  const i = spec.inputs;
  const parts: string[] = [];
  if (i.runLengthM) parts.push(`${fmtNum(i.runLengthM)} m run`);
  if (i.lengthM) parts.push(`${fmtNum(i.lengthM)} m long`);
  if (i.widthM) parts.push(`${fmtNum(i.widthM)} m wide`);
  if (i.heightM) parts.push(`${fmtNum(i.heightM)} m high`);
  if (i.areaM2 && !i.lengthM) parts.push(`${fmtNum(i.areaM2)} m²`);
  if (spec.options.surface) parts.push(spec.options.surface === "wall" ? "walls" : spec.options.surface);
  return parts.join(", ");
}

function emptyReply(partial: Partial<AssistantReply> & Pick<AssistantReply, "text" | "intent">): AssistantReply {
  return { quickReplies: [], estimate: null, productQuery: null, action: null, ...partial };
}

/** Rule-based reading of a message in the context of the current job. */
export function interpretWithRules(message: string, state: AssistantState): Interpretation {
  const text = normalise(message);
  const intent = detectIntent(text);
  const jobType = intent ?? state.job?.type ?? null;
  const details = parseDetails(text, jobType);
  if (!jobType) {
    return { intent: "search", inputs: {}, merged: false, options: {}, searchQuery: message.trim() };
  }
  const base: JobSpec =
    intent && intent !== state.job?.type ? { type: intent, inputs: {}, options: {} } : (state.job ?? { type: jobType, inputs: {}, options: {} });
  const def = JOBS[jobType];
  const options = { ...base.options, ...details.options };
  const order = def.dimensionOrder({ ...base, options }) as DimensionKey[];
  const inputs = applyDetails(base.inputs, details, order, state.awaiting, jobType);
  if (!intent && !hasAnyDetail(details)) {
    return { intent: "search", inputs: {}, merged: false, options: {}, searchQuery: message.trim() };
  }
  return { intent: jobType, inputs, merged: true, options: details.options, searchQuery: null };
}

export function respond(
  state: AssistantState,
  message: string,
  deps: { lookup: MaterialLookup; interpretation?: Interpretation },
): { state: AssistantState; reply: AssistantReply } {
  const text = normalise(message);

  if (RESET_RE.test(text)) {
    return {
      state: INITIAL_STATE,
      reply: emptyReply({
        intent: "reset",
        text: "No problem — let's start a new job. Describe what you're working on, or pick one of these:",
        quickReplies: JOB_STARTERS,
      }),
    };
  }
  if (HELP_RE.test(text) && !detectIntent(text)) {
    return {
      state,
      reply: emptyReply({
        intent: "help",
        text:
          "I can help you find products and work out quantities. Describe a job with measurements — for example “paint a 4m x 3m bedroom” — and I'll ask anything I need, show my working and build a list you can edit and add to your basket. I can also search the catalogue: try “screws for plasterboard”.",
        quickReplies: JOB_STARTERS.slice(0, 4),
      }),
    };
  }
  if (ADD_RE.test(text) && state.job && !JOBS[state.job.type].nextQuestion(state.job)) {
    return {
      state,
      reply: emptyReply({
        intent: "add",
        action: "add-to-basket",
        text: "Adding the materials from your estimate to the basket (optional tools are left out). You can review and change quantities there.",
        quickReplies: ["Start a new job"],
      }),
    };
  }

  const interpretation = deps.interpretation ?? interpretWithRules(message, state);

  if (interpretation.intent === "search" || interpretation.intent === "none") {
    const query = interpretation.searchQuery ?? message.trim();
    return {
      state,
      reply: emptyReply({
        intent: "search",
        productQuery: query,
        text: state.job
          ? `Here's what I found for “${query}”. Your ${JOBS[state.job.type].title.toLowerCase()} estimate is still saved — just carry on describing it.`
          : `Here's what I found for “${query}”. If you're planning a job, tell me about it and I'll work out quantities.`,
        quickReplies: state.job ? REFINEMENTS[state.job.type](state.job) : JOB_STARTERS.slice(0, 4),
      }),
    };
  }

  const isNewJob = !state.job || state.job.type !== interpretation.intent;
  const previous: JobSpec = isNewJob ? { type: interpretation.intent, inputs: {}, options: {} } : state.job!;
  const job: JobSpec = {
    type: interpretation.intent,
    inputs: interpretation.merged ? interpretation.inputs : { ...previous.inputs, ...interpretation.inputs },
    options: { ...previous.options, ...interpretation.options },
  };
  const def = JOBS[job.type];
  const question = def.nextQuestion(job);

  if (question) {
    const known = describeInputs(job);
    const intro = isNewJob ? `Let's work out what you need to ${def.title.toLowerCase()}.` : "Thanks.";
    return {
      state: { job, awaiting: question.field },
      reply: emptyReply({
        intent: job.type,
        text: `${intro}${known ? ` So far: ${known}.` : ""} ${question.question}`,
        quickReplies: question.quickReplies,
        productQuery: isNewJob && !known ? JOB_PRODUCT_QUERY[job.type] : null,
      }),
    };
  }

  const estimate = def.estimate(job, deps.lookup);
  const lowConfidence = estimate.confidence !== "high" ? " Some figures depend on site conditions, so please sense-check them." : "";
  return {
    state: { job, awaiting: null },
    reply: emptyReply({
      intent: job.type,
      estimate,
      text: `${estimate.summary} I've shown how I worked out each quantity — change anything you like before adding it to your basket.${lowConfidence}`,
      quickReplies: [...REFINEMENTS[job.type](job), "Start a new job"],
    }),
  };
}

export { JOB_LIST };
