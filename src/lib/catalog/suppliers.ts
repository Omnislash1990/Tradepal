import type { SupplierDeliveryCosts } from "@/lib/domain/delivery";
import type { CategorySlug } from "./categories";

export type SampleSupplier = {
  code: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  integration: "api" | "csv" | "email";
  servesAreas: string[];
  leadTimeDays: number;
  cutoffHour: number;
  deliversSaturday: boolean;
  deliveryCosts: SupplierDeliveryCosts;
  paymentTerms: string;
  categories: CategorySlug[];
  extraSkus?: string[];
  /** Range applied to the reference cost for this supplier's prices. */
  costFactor: [number, number];
  /** Share of eligible products this supplier lists. */
  coverage: number;
  stockVerified: boolean;
  notes: string;
};

/**
 * Fictional suppliers so the whole workflow can be demonstrated. Replace with real merchants,
 * their agreed prices, delivery charges and feed details before launch.
 */
export const SAMPLE_SUPPLIERS: SampleSupplier[] = [
  {
    code: "MBM",
    name: "Midlands Builders Merchant (sample)",
    contactName: "Trade desk",
    email: "orders@mbm.sample.invalid",
    phone: "0121 000 0101",
    integration: "api",
    servesAreas: ["B", "CV", "DY", "WS", "WV", "WR", "ST", "TF"],
    leadTimeDays: 1,
    cutoffHour: 13,
    deliversSaturday: true,
    deliveryCosts: { parcel: 450, standard: 900, heavy: 2500, freeOverNet: 50000 },
    paymentTerms: "30 days end of month",
    categories: ["plasterboard-plaster", "timber-sheet", "building-materials", "insulation", "landscaping-fencing", "fixings-adhesives"],
    extraSkus: ["TL-TROWEL-14", "TL-HAWK-13", "TL-PBSAW", "TL-KNIFE", "TL-LEVEL-1200", "TL-SAW-22", "TL-TAPE-8", "TL-HAMMER-16"],
    costFactor: [0.97, 1.02],
    coverage: 1,
    stockVerified: true,
    notes: "Simulated live API: stock and prices sync automatically, purchase orders are confirmed instantly.",
  },
  {
    code: "BCP",
    name: "Black Country Plumbing & Heating (sample)",
    contactName: "Sales office",
    email: "sales@bcp.sample.invalid",
    phone: "01902 000 202",
    integration: "csv",
    servesAreas: ["B", "DY", "WS", "WV"],
    leadTimeDays: 1,
    cutoffHour: 15,
    deliversSaturday: false,
    deliveryCosts: { parcel: 400, standard: 800, heavy: 2200, freeOverNet: 25000 },
    paymentTerms: "30 days",
    categories: ["plumbing-heating", "bathrooms"],
    extraSkus: ["FX-SIL-SAN-WHT", "PH-PTFE-5"],
    costFactor: [0.96, 1.01],
    coverage: 1,
    stockVerified: true,
    notes: "Sends a nightly CSV stock and price file.",
  },
  {
    code: "BEW",
    name: "Brum Electrical Wholesale (sample)",
    contactName: "Counter",
    email: "counter@bew.sample.invalid",
    phone: "0121 000 0303",
    integration: "email",
    servesAreas: ["B", "CV", "DY", "WS", "WV"],
    leadTimeDays: 1,
    cutoffHour: 16,
    deliversSaturday: false,
    deliveryCosts: { parcel: 395, standard: 750, heavy: 2000, freeOverNet: 15000 },
    paymentTerms: "Proforma until account opened",
    categories: ["electrical", "tools"],
    costFactor: [0.98, 1.03],
    coverage: 1,
    stockVerified: true,
    notes: "Purchase orders by email; stock confirmed by phone each morning.",
  },
  {
    code: "WMD",
    name: "West Mids Decor & Tile Centre (sample)",
    contactName: "Trade counter",
    email: "trade@wmd.sample.invalid",
    phone: "024 0000 0404",
    integration: "csv",
    servesAreas: ["B", "CV", "DY", "WS", "WV"],
    leadTimeDays: 2,
    cutoffHour: 14,
    deliversSaturday: false,
    deliveryCosts: { parcel: 450, standard: 850, heavy: 2400, freeOverNet: 30000 },
    paymentTerms: "30 days",
    categories: ["decorating", "tiling-flooring"],
    extraSkus: ["FX-GRAB-290", "FX-SIL-SAN-WHT", "TL-TILECUT-600", "TL-NOTCH-10", "DC-FILLER-RM"],
    costFactor: [0.95, 1.0],
    coverage: 1,
    stockVerified: true,
    notes: "Weekly CSV price file, daily stock file.",
  },
  {
    code: "NDD",
    name: "National DIY Distributor (sample)",
    contactName: "Account manager",
    email: "orders@ndd.sample.invalid",
    phone: "0800 000 0505",
    integration: "email",
    servesAreas: ["*"],
    leadTimeDays: 3,
    cutoffHour: 12,
    deliversSaturday: false,
    deliveryCosts: { parcel: 595, standard: 1095, heavy: 3495, freeOverNet: null },
    paymentTerms: "14 days",
    categories: [
      "plasterboard-plaster",
      "timber-sheet",
      "building-materials",
      "insulation",
      "plumbing-heating",
      "electrical",
      "tools",
      "bathrooms",
      "decorating",
      "tiling-flooring",
      "fixings-adhesives",
      "landscaping-fencing",
    ],
    costFactor: [1.06, 1.12],
    coverage: 0.7,
    stockVerified: false,
    notes: "Back-up supplier with nationwide delivery. No stock feed, so availability is confirmed after ordering.",
  },
];

export const SAMPLE_ZONES = [
  {
    name: "West Midlands core",
    postcodePrefixes: ["B", "CV", "DY", "WS", "WV"],
    active: true,
    extraLeadDays: 0,
    sortOrder: 1,
    notes: "Launch area. Rates are illustrative — confirm with suppliers before launch.",
    rates: {
      parcel: { chargeGross: 499, freeOverGross: 5000 },
      standard: { chargeGross: 999, freeOverGross: 15000 },
      heavy: { chargeGross: 2999, freeOverGross: 60000 },
    },
  },
  {
    name: "Wider West Midlands",
    postcodePrefixes: ["WR", "ST", "TF", "HR"],
    active: false,
    extraLeadDays: 1,
    sortOrder: 2,
    notes: "Phase 4 expansion. Switch on once supplier coverage is agreed.",
    rates: {
      parcel: { chargeGross: 699, freeOverGross: 7500 },
      standard: { chargeGross: 1499, freeOverGross: 20000 },
      heavy: { chargeGross: 3999, freeOverGross: 80000 },
    },
  },
];
