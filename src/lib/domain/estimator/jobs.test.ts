import { describe, expect, it } from "vitest";
import { chooseTins } from "./helpers";
import { JOBS } from "./jobs";
import { seedLookup } from "./test-lookup";
import type { Estimate, JobSpec } from "./types";

const lookup = seedLookup();
const run = (spec: JobSpec) => JOBS[spec.type].estimate(spec, lookup);
const qty = (e: Estimate, sku: string) => e.lines.find((l) => l.sku === sku)?.quantity;

describe("chooseTins", () => {
  const tins = [
    { sku: "10", litres: 10, price: 5508 },
    { sku: "5", litres: 5, price: 3078 },
    { sku: "2.5", litres: 2.5, price: 1863 },
  ];
  it("finds the cheapest combination that covers the litres", () => {
    expect(chooseTins(7.1, tins)).toEqual([
      { sku: "5", litres: 5, count: 1 },
      { sku: "2.5", litres: 2.5, count: 1 },
    ]);
    expect(chooseTins(9, tins)).toEqual([{ sku: "10", litres: 10, count: 1 }]);
    expect(chooseTins(0, tins)).toEqual([]);
  });
});

describe("estimators", () => {
  it("plasterboard wall", () => {
    const e = run({ type: "plasterboard", inputs: { lengthM: 4.2, heightM: 2.4 }, options: { surface: "wall" } });
    expect(qty(e, "PB-STD-125-TE")).toBe(4);
    expect(qty(e, "FX-DWS-38-1000")).toBe(1);
    expect(qty(e, "PL-MF-25")).toBe(2);
    expect(qty(e, "PL-SCRIM-90")).toBe(1);
    expect(e.confidence).toBe("high");
    expect(e.assumptions.join(" ")).toMatch(/10% added/);
  });

  it("flags unavailable products", () => {
    const e = run({ type: "plasterboard", inputs: { lengthM: 4, heightM: 2.4 }, options: { boardType: "acoustic" } });
    expect(e.lines.find((l) => l.sku === "PB-AC-15-TE")?.available).toBe(false);
    expect(e.warnings.join(" ")).toMatch(/currently unavailable/);
  });

  it("paints a room with ceiling, openings and tin optimisation", () => {
    const e = run({ type: "paint", inputs: { lengthM: 4, widthM: 3, heightM: 2.4 }, options: {} });
    // Walls 33.6 m² − door 1.6 − window 1.2 = 30.8 m², ceiling 12 m², 2 coats at 12 m²/L = 7.13 L.
    expect(e.summary).toMatch(/7\.1 litres/);
    expect(qty(e, "DC-VM-WHT-5")).toBe(1);
    expect(qty(e, "DC-VM-WHT-25")).toBe(1);
    expect(qty(e, "DC-VM-WHT-10")).toBeUndefined();
  });

  it("adds a mist coat on new plaster and drops the ceiling when asked", () => {
    const e = run({
      type: "paint",
      inputs: { lengthM: 4, widthM: 3, heightM: 2.4 },
      options: { newPlaster: true, includeCeiling: false },
    });
    expect(qty(e, "DC-CM-WHT-10")).toBe(1);
    expect(e.measurements.some((m) => m.label === "Ceiling")).toBe(false);
  });

  it("tiles a floor", () => {
    const e = run({ type: "tile", inputs: { lengthM: 2.5, widthM: 2 }, options: { surface: "floor" } });
    expect(qty(e, "TF-FLOOR-GRY-6060")).toBe(4);
    expect(qty(e, "TF-ADH-FLEX-20")).toBe(2);
    expect(qty(e, "TF-GROUT-GRY-5")).toBe(1);
    expect(qty(e, "TF-SPACER-3")).toBe(1);
  });

  it("builds a stud wall with a door", () => {
    const e = run({ type: "stud-wall", inputs: { lengthM: 3.6, heightM: 2.4, doors: 1 }, options: {} });
    expect(qty(e, "TM-CLS-63-24")).toBe(15);
    expect(qty(e, "PB-STD-125-TE")).toBe(6);
    expect(e.lines.find((l) => l.sku === "IN-ACOUSTIC-50")?.optional).toBe(true);
  });

  it("fences a run with gravel boards", () => {
    const e = run({ type: "fence", inputs: { runLengthM: 20 }, options: {} });
    expect(qty(e, "LF-PANEL-OL-66")).toBe(11);
    expect(qty(e, "LF-POST-75-27")).toBe(12);
    expect(qty(e, "LF-GRAVELBOARD-183")).toBe(11);
    expect(qty(e, "LF-POSTMIX-20")).toBe(24);
    expect(qty(e, "LF-CLIPS-8")).toBe(6);
  });

  it("uses shorter posts without gravel boards", () => {
    const e = run({ type: "fence", inputs: { runLengthM: 10 }, options: { gravelBoards: false, panelHeight: "5ft" } });
    expect(qty(e, "LF-PANEL-OL-65")).toBe(6);
    expect(qty(e, "LF-POST-75-24")).toBe(7);
    expect(qty(e, "LF-GRAVELBOARD-183")).toBeUndefined();
  });

  it("mixes a concrete base", () => {
    const e = run({ type: "concrete-base", inputs: { lengthM: 3, widthM: 2.4 }, options: {} });
    expect(qty(e, "BM-CEM-25")).toBe(12);
    expect(qty(e, "BM-BALLAST-BB")).toBe(2);
    expect(qty(e, "BM-MOT1-BB")).toBe(2);
    expect(e.lines.find((l) => l.sku === "TM-C24-47100-48")).toMatchObject({ quantity: 3, optional: true });
  });

  it("recommends ready-mix for big pours", () => {
    const e = run({ type: "concrete-base", inputs: { lengthM: 6, widthM: 4, depthMm: 150 }, options: {} });
    expect(e.warnings[0]).toMatch(/ready-mixed/);
  });

  it("lays a patio", () => {
    const e = run({ type: "patio", inputs: { lengthM: 4, widthM: 3 }, options: {} });
    expect(qty(e, "LF-SLAB-BUFF-600")).toBe(35);
    expect(qty(e, "BM-MOT1-BB")).toBe(3);
    expect(qty(e, "BM-SAND-SHP-BB")).toBe(2);
    expect(qty(e, "BM-CEM-25")).toBe(6);
  });

  it("lays laminate", () => {
    const e = run({ type: "flooring", inputs: { lengthM: 5, widthM: 4 }, options: {} });
    expect(qty(e, "TF-LAM-OAK-8")).toBe(10);
    expect(qty(e, "TF-UNDERLAY-3")).toBe(2);
    expect(qty(e, "TF-SCOTIA-OAK-24")).toBe(8);
    expect(qty(e, "FX-GRAB-290")).toBe(2);
  });

  it("tops up loft insulation based on what's there", () => {
    const empty = run({ type: "loft-insulation", inputs: { lengthM: 8, widthM: 5 }, options: { existingInsulationMm: 0 } });
    expect(qty(empty, "IN-LOFT-100")).toBe(6);
    expect(qty(empty, "IN-LOFT-170")).toBe(9);
    const some = run({ type: "loft-insulation", inputs: { lengthM: 8, widthM: 5 }, options: { existingInsulationMm: 100 } });
    expect(qty(some, "IN-LOFT-100")).toBeUndefined();
    expect(qty(some, "IN-LOFT-170")).toBe(9);
    const full = run({ type: "loft-insulation", inputs: { lengthM: 8, widthM: 5 }, options: { existingInsulationMm: 300 } });
    expect(full.lines.filter((l) => !l.optional)).toHaveLength(0);
  });

  it("skims walls", () => {
    const e = run({ type: "skim", inputs: { lengthM: 4, heightM: 2.4 }, options: {} });
    expect(qty(e, "PL-MF-25")).toBe(2);
    expect(qty(e, "PL-PVA-5")).toBe(1);
  });

  it("every job asks for what it needs, then estimates", () => {
    for (const job of Object.values(JOBS)) {
      const first = job.nextQuestion({ type: job.type, inputs: {}, options: {} });
      expect(first, job.type).not.toBeNull();
      expect(first!.quickReplies.length).toBeGreaterThan(0);
    }
  });
});
