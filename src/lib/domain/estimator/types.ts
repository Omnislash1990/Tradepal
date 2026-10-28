import type { ProductAttributes } from "@/lib/catalog/types";

export type JobType =
  | "plasterboard"
  | "skim"
  | "paint"
  | "tile"
  | "stud-wall"
  | "fence"
  | "concrete-base"
  | "patio"
  | "flooring"
  | "loft-insulation";

export type JobInputs = {
  lengthM?: number;
  widthM?: number;
  heightM?: number;
  areaM2?: number;
  depthMm?: number;
  runLengthM?: number;
  doors?: number;
  windows?: number;
};

export type JobOptions = {
  surface?: "wall" | "ceiling" | "floor";
  boardType?: "standard" | "moisture" | "fire" | "acoustic";
  coats?: number;
  includeCeiling?: boolean;
  newPlaster?: boolean;
  colour?: "white" | "magnolia";
  tileSize?: "300x600" | "100x200" | "600x600";
  layout?: "straight" | "diagonal";
  wastePct?: number;
  studSize?: 63 | 89;
  insulation?: boolean;
  panelHeight?: "6ft" | "5ft";
  gravelBoards?: boolean;
  existingInsulationMm?: number;
  subBase?: boolean;
};

export type JobSpec = { type: JobType; inputs: JobInputs; options: JobOptions };

export type MaterialProduct = {
  sku: string;
  name: string;
  unitGross: number;
  available: boolean;
  attributes: ProductAttributes;
};

export type MaterialLookup = (sku: string) => MaterialProduct | undefined;

export type EstimateGroup = "materials" | "fixings" | "finishing" | "tools";

export type EstimateLine = {
  sku: string;
  name: string;
  quantity: number;
  unitGross: number;
  reason: string;
  group: EstimateGroup;
  optional: boolean;
  available: boolean;
};

export type Confidence = "high" | "medium" | "low";

export type Estimate = {
  jobType: JobType;
  title: string;
  summary: string;
  measurements: { label: string; value: string }[];
  assumptions: string[];
  warnings: string[];
  lines: EstimateLine[];
  confidence: Confidence;
  totalGross: number;
};

export type FieldKey = "lengthM" | "widthM" | "heightM" | "areaM2" | "runLengthM" | "surface" | "existingInsulationMm";

export type FieldQuestion = { field: FieldKey; question: string; quickReplies: string[] };

export type JobDefinition = {
  type: JobType;
  title: string;
  starter: string;
  /** Which way two bare dimensions ("4 x 2.4") should be read for this job. */
  dimensionOrder: (spec: JobSpec) => ("lengthM" | "widthM" | "heightM" | "depthMm")[];
  nextQuestion: (spec: JobSpec) => FieldQuestion | null;
  estimate: (spec: JobSpec, lookup: MaterialLookup) => Estimate;
};
