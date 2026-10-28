import {
  LineBuilder,
  ceilQty,
  chooseTins,
  finishEstimate,
  fmtM,
  fmtM2,
  fmtM3,
  fmtNum,
  plural,
} from "./helpers";
import { DOOR_M2, SKU, WINDOW_M2 } from "./materials";
import type { FieldKey, FieldQuestion, JobDefinition, JobOptions, JobSpec, JobType } from "./types";

const q = (field: FieldKey, question: string, quickReplies: string[]): FieldQuestion => ({
  field,
  question,
  quickReplies,
});

function rectArea(spec: JobSpec, second: "heightM" | "widthM"): number {
  const { areaM2, lengthM } = spec.inputs;
  const other = spec.inputs[second];
  if (lengthM && other) return lengthM * other;
  if (areaM2 && areaM2 > 0) return areaM2;
  return 0;
}

function askRect(
  spec: JobSpec,
  second: "heightM" | "widthM",
  texts: { length: FieldQuestion; second: FieldQuestion },
): FieldQuestion | null {
  if (spec.inputs.lengthM && spec.inputs[second]) return null;
  if (spec.inputs.areaM2) return null;
  if (!spec.inputs.lengthM) return texts.length;
  return texts.second;
}

function openingsDeduction(spec: JobSpec): { m2: number; note: string | null } {
  const doors = spec.inputs.doors ?? 0;
  const windows = spec.inputs.windows ?? 0;
  const m2 = doors * DOOR_M2 + windows * WINDOW_M2;
  if (m2 === 0) return { m2, note: null };
  return {
    m2,
    note: `Deducted ${plural(doors, "door")} (${DOOR_M2} m² each) and ${plural(windows, "window")} (${WINDOW_M2} m² each).`,
  };
}

function waste(spec: JobSpec, fallbackPct: number) {
  const pct = spec.options.wastePct ?? fallbackPct;
  return { pct, factor: 1 + pct / 100 };
}

function rectMeasurements(spec: JobSpec, second: "heightM" | "widthM", area: number) {
  const m: { label: string; value: string }[] = [];
  if (spec.inputs.lengthM) m.push({ label: "Length", value: fmtM(spec.inputs.lengthM) });
  const other = spec.inputs[second];
  if (other) m.push({ label: second === "heightM" ? "Height" : "Width", value: fmtM(other) });
  m.push({ label: "Area", value: fmtM2(area) });
  return m;
}

const BOARD_SKU: Record<NonNullable<JobOptions["boardType"]>, string> = {
  standard: SKU.board125,
  moisture: SKU.boardMoisture,
  fire: SKU.boardFire,
  acoustic: SKU.boardAcoustic,
};

const BOARD_NOTE: Record<NonNullable<JobOptions["boardType"]>, string> = {
  standard: "Standard 12.5 mm tapered-edge board suits most walls and ceilings.",
  moisture:
    "Moisture-resistant board for kitchens and bathrooms (use cement backer board inside showers).",
  fire: "Fire-resistant board — confirm the fire rating you need with Building Control.",
  acoustic: "15 mm acoustic board for better sound insulation between rooms.",
};

function addSkimFinish(b: LineBuilder, areaWithWaste: number, boardArea: number) {
  const bagCoverage = b.attr(SKU.multiFinish).coverageM2 ?? 10;
  const bags = ceilQty(areaWithWaste / bagCoverage);
  b.add(
    SKU.multiFinish,
    bags,
    `${fmtM2(areaWithWaste)} ÷ ${bagCoverage} m² per 25 kg bag at 2 mm thick → ${bags}`,
    "finishing",
  );
  const rollLength = b.attr(SKU.scrim).lengthM ?? 90;
  const jointM = boardArea * 1.5;
  b.add(
    SKU.scrim,
    Math.max(1, ceilQty(jointM / rollLength)),
    `About ${fmtNum(jointM, 0)} m of board joints ÷ ${rollLength} m per roll`,
    "finishing",
  );
}

const plasterboardJob: JobDefinition = {
  type: "plasterboard",
  title: "Plasterboard a wall or ceiling",
  starter: "I need to plasterboard a wall 4.2m long and 2.4m high",
  dimensionOrder: (spec) => (spec.options.surface === "ceiling" ? ["lengthM", "widthM"] : ["lengthM", "heightM"]),
  nextQuestion(spec) {
    const ceiling = spec.options.surface === "ceiling";
    return askRect(spec, ceiling ? "widthM" : "heightM", {
      length: ceiling
        ? q("lengthM", "What size is the ceiling? For example 4m x 3m.", ["3m x 3m", "4m x 3m", "5m x 4m"])
        : q("lengthM", "How long is the wall, in metres?", ["3m", "4.2m", "5m"]),
      second: ceiling
        ? q("widthM", "And how wide is the ceiling?", ["2.5m", "3m", "3.5m"])
        : q("heightM", "And how high is the wall?", ["2.4m (standard)", "2.7m", "3m"]),
    });
  },
  estimate(spec, lookup) {
    const ceiling = spec.options.surface === "ceiling";
    const grossArea = rectArea(spec, ceiling ? "widthM" : "heightM");
    const openings = ceiling ? { m2: 0, note: null } : openingsDeduction(spec);
    const area = Math.max(0, grossArea - openings.m2);
    const w = waste(spec, 10);
    const boardType = spec.options.boardType ?? "standard";
    const boardSku = BOARD_SKU[boardType];
    const b = new LineBuilder(lookup);
    const boardCoverage = b.attr(boardSku).coverageM2 ?? 2.88;
    const boards = ceilQty((area * w.factor) / boardCoverage);
    b.add(
      boardSku,
      boards,
      `${fmtM2(area)} + ${w.pct}% waste = ${fmtM2(area * w.factor)} ÷ ${boardCoverage} m² per board → ${boards}`,
      "materials",
    );
    const perBoard = ceiling ? 35 : 30;
    const perBox = b.attr(SKU.drywallScrews).packQty ?? 1000;
    b.add(
      SKU.drywallScrews,
      ceilQty((boards * perBoard) / perBox),
      `${boards} boards × about ${perBoard} screws = ${boards * perBoard} screws`,
      "fixings",
    );
    addSkimFinish(b, area * w.factor, area);
    if (!ceiling) b.add(SKU.angleBead, 2, "Only needed on external corners", "finishing", true);
    b.add(SKU.plasterboardSaw, 1, "Cutting boards around openings", "tools", true);
    b.add(SKU.knife, 1, "Score-and-snap straight cuts", "tools", true);
    b.add(SKU.trowel, 1, "Applying and polishing the skim coat", "tools", true);
    b.add(SKU.hawk, 1, "Holds plaster while you skim", "tools", true);

    const assumptions = [
      `Boards are 2400 × 1200 mm (${boardCoverage} m² each). ${BOARD_NOTE[boardType]}`,
      `${w.pct}% added for cuts and waste.`,
      `About ${perBoard} drywall screws per board${ceiling ? " (closer spacing on ceilings)" : ""}.`,
      "Finished with a 2 mm skim of multi-finish plaster over scrim-taped joints.",
    ];
    if (openings.note) assumptions.push(openings.note);
    else if (!ceiling) assumptions.push("No doors or windows deducted — tell me if the wall has any.");

    const warnings: string[] = [];
    if (ceiling) warnings.push("Ceiling boards are heavy — use a board lifter or work with a second person.");
    if (!ceiling && (spec.inputs.heightM ?? 0) > 2.4)
      warnings.push("The wall is taller than one 2.4 m board, so you'll be fitting cut strips along the top.");
    if (area > 60) warnings.push("That's a large area — treat this as a rough guide and measure on site before ordering.");

    return finishEstimate({
      jobType: "plasterboard",
      title: ceiling ? "Plasterboard a ceiling" : "Plasterboard a wall",
      summary: `${fmtM2(area)} of ${ceiling ? "ceiling" : "wall"} needs ${plural(boards, "board")}, plus screws and finishing plaster.`,
      measurements: [
        ...rectMeasurements(spec, ceiling ? "widthM" : "heightM", grossArea),
        ...(openings.m2 > 0 ? [{ label: "After openings", value: fmtM2(area) }] : []),
      ],
      assumptions,
      warnings,
      lines: b.lines,
      confidence: spec.inputs.lengthM ? "high" : "medium",
    });
  },
};

const skimJob: JobDefinition = {
  type: "skim",
  title: "Skim (re-plaster) walls",
  starter: "I want to skim a wall 4m long and 2.4m high",
  dimensionOrder: () => ["lengthM", "heightM"],
  nextQuestion: (spec) =>
    askRect(spec, "heightM", {
      length: q("lengthM", "How long is the wall you want to skim? You can also give me the total area in m².", [
        "3.5m",
        "4m",
        "20 m²",
      ]),
      second: q("heightM", "And how high is it?", ["2.4m (standard)", "2.7m", "3m"]),
    }),
  estimate(spec, lookup) {
    const grossArea = rectArea(spec, "heightM");
    const openings = openingsDeduction(spec);
    const area = Math.max(0, grossArea - openings.m2);
    const w = waste(spec, 10);
    const b = new LineBuilder(lookup);
    const bagCoverage = b.attr(SKU.multiFinish).coverageM2 ?? 10;
    const bags = ceilQty((area * w.factor) / bagCoverage);
    b.add(
      SKU.multiFinish,
      bags,
      `${fmtM2(area)} + ${w.pct}% = ${fmtM2(area * w.factor)} ÷ ${bagCoverage} m² per bag → ${bags}`,
      "materials",
    );
    const pvaCoverage = b.attr(SKU.pva).coverageM2 ?? 30;
    b.add(SKU.pva, ceilQty(area / pvaCoverage), `${fmtM2(area)} ÷ about ${pvaCoverage} m² per 5 L tub diluted 1:4`, "materials");
    b.add(SKU.scrim, 1, "Bridges cracks before skimming", "finishing", true);
    b.add(SKU.angleBead, 2, "Only for damaged external corners", "finishing", true);
    b.add(SKU.trowel, 1, "Applying and polishing the skim", "tools", true);
    b.add(SKU.hawk, 1, "Holds plaster while you skim", "tools", true);
    b.add(SKU.dustSheet, 1, "Protects floors from splashes", "tools", true);
    const assumptions = [
      "The existing plaster is sound and reasonably flat.",
      "Two thin coats with a total thickness of about 2 mm.",
      "Walls sealed with PVA first so the skim doesn't dry too fast.",
      `${w.pct}% added for mixing waste.`,
    ];
    if (openings.note) assumptions.push(openings.note);
    return finishEstimate({
      jobType: "skim",
      title: "Skim walls",
      summary: `Skimming ${fmtM2(area)} takes about ${plural(bags, "bag")} of multi-finish plaster.`,
      measurements: rectMeasurements(spec, "heightM", grossArea),
      assumptions,
      warnings: [
        "If the old plaster is loose (‘blown’) or very uneven it may need hacking off and an undercoat such as bonding or hardwall first.",
      ],
      lines: b.lines,
      confidence: "medium",
    });
  },
};

const paintJob: JobDefinition = {
  type: "paint",
  title: "Paint a room",
  starter: "Paint a bedroom 4m x 3m with 2.4m high walls",
  dimensionOrder: () => ["lengthM", "widthM", "heightM"],
  nextQuestion(spec) {
    const i = spec.inputs;
    if (i.areaM2 && !i.lengthM) return null;
    if (!i.lengthM) return q("lengthM", "What size is the room? Give me the floor size, for example 4m x 3m.", ["3m x 3m", "4m x 3m", "5m x 4m"]);
    if (!i.widthM) return q("widthM", "And how wide is the room?", ["2.5m", "3m", "4m"]);
    if (!i.heightM) return q("heightM", "How high are the walls?", ["2.4m (standard)", "2.6m", "3m"]);
    return null;
  },
  estimate(spec, lookup) {
    const { lengthM = 0, widthM = 0, heightM = 0 } = spec.inputs;
    const areaOnly = !(lengthM && widthM && heightM) && !!spec.inputs.areaM2;
    const doors = spec.inputs.doors ?? 1;
    const windows = spec.inputs.windows ?? 1;
    const includeCeiling = !areaOnly && (spec.options.includeCeiling ?? true);
    const coats = spec.options.coats ?? 2;
    const colour = spec.options.colour ?? "white";
    const wallArea = areaOnly
      ? spec.inputs.areaM2!
      : Math.max(0, 2 * (lengthM + widthM) * heightM - doors * DOOR_M2 - windows * WINDOW_M2);
    const ceilingArea = includeCeiling ? lengthM * widthM : 0;

    const b = new LineBuilder(lookup);
    const spread = b.attr(SKU.vmWhite10).coverageM2PerLitre ?? 12;
    const wallLitres = (wallArea * coats) / spread;
    const ceilingLitres = (ceilingArea * coats) / spread;
    const whiteTins = [SKU.vmWhite10, SKU.vmWhite5, SKU.vmWhite25]
      .map((sku) => ({ sku, litres: lookup(sku)?.attributes.litres ?? 0, price: lookup(sku)?.unitGross ?? 0, ok: lookup(sku)?.available ?? false }))
      .filter((t) => t.litres > 0 && t.ok);

    const addTins = (litres: number, label: string) => {
      const tins = chooseTins(litres, whiteTins);
      tins.forEach((t, i) =>
        b.add(t.sku, t.count, i === 0 ? label : "Tops up to the litres needed at the lowest cost", "materials"),
      );
    };

    if (colour === "magnolia") {
      const tinLitres = lookup(SKU.vmMagnolia5)?.attributes.litres ?? 5;
      b.add(
        SKU.vmMagnolia5,
        ceilQty(wallLitres / tinLitres),
        `${fmtM2(wallArea)} of walls × ${coats} coats ÷ ${spread} m²/L = ${fmtNum(wallLitres, 1)} L`,
        "materials",
      );
      if (ceilingLitres > 0)
        addTins(ceilingLitres, `Ceiling: ${fmtM2(ceilingArea)} × ${coats} coats ÷ ${spread} m²/L = ${fmtNum(ceilingLitres, 1)} L of white`);
    } else {
      const total = wallLitres + ceilingLitres;
      addTins(
        total,
        `${fmtM2(wallArea)} of walls${ceilingArea ? ` + ${fmtM2(ceilingArea)} of ceiling` : ""} × ${coats} coats ÷ ${spread} m²/L = ${fmtNum(total, 1)} L`,
      );
    }
    if (spec.options.newPlaster) {
      const mistSpread = lookup(SKU.contractMatt10)?.attributes.coverageM2PerLitre ?? 14;
      const mistLitres = (wallArea + ceilingArea) / mistSpread;
      b.add(
        SKU.contractMatt10,
        ceilQty(mistLitres / 10),
        `Mist coat on new plaster: ${fmtM2(wallArea + ceilingArea)} ÷ ${mistSpread} m²/L = ${fmtNum(mistLitres, 1)} L`,
        "materials",
      );
    }
    const perimeter = areaOnly ? Math.sqrt(wallArea) * 4 : 2 * (lengthM + widthM);
    const maskM = perimeter + doors * 5 + windows * 5;
    b.add(SKU.rollerKit, 1, "For walls and ceiling", "finishing");
    b.add(SKU.maskingTape, Math.max(1, ceilQty(maskM / 50)), `About ${fmtNum(maskM, 0)} m of edges to mask`, "finishing");
    b.add(SKU.dustSheet, 1, "Protects floors and furniture", "finishing");
    b.add(SKU.brushSet, 1, "Cutting in around edges", "tools", true);
    b.add(SKU.filler, 1, "Filling holes and cracks before painting", "finishing", true);
    b.add(SKU.caulk, 1, "Sealing gaps along skirting and frames", "finishing", true);

    const assumptions = [
      `${coats} coats of vinyl matt emulsion at about ${spread} m² per litre per coat.`,
      areaOnly
        ? "Calculated from the wall area you gave me."
        : `${plural(doors, "door")} and ${plural(windows, "window")} deducted (tell me if that's wrong).`,
      includeCeiling ? "Ceiling painted brilliant white." : "Ceiling not included.",
      "Skirting, doors and frames aren't included — ask me about satinwood for woodwork.",
    ];
    if (spec.options.newPlaster) assumptions.push("Fresh plaster gets a thinned mist coat before the top coats.");
    const warnings: string[] = [];
    if (coats < 3) warnings.push("Going from a strong colour to a light one can need a third coat.");
    return finishEstimate({
      jobType: "paint",
      title: "Paint a room",
      summary: `About ${fmtNum(wallLitres + ceilingLitres, 1)} litres of paint for ${fmtM2(wallArea + ceilingArea)} over ${coats} coats.`,
      measurements: [
        ...(areaOnly
          ? [{ label: "Wall area", value: fmtM2(wallArea) }]
          : [
              { label: "Room", value: `${fmtM(lengthM)} × ${fmtM(widthM)}` },
              { label: "Wall height", value: fmtM(heightM) },
              { label: "Wall area (net)", value: fmtM2(wallArea) },
            ]),
        ...(ceilingArea ? [{ label: "Ceiling", value: fmtM2(ceilingArea) }] : []),
      ],
      assumptions,
      warnings,
      lines: b.lines,
      confidence: areaOnly ? "medium" : "high",
    });
  },
};

const TILE_BY_SIZE: Record<NonNullable<JobOptions["tileSize"]>, string> = {
  "300x600": SKU.wallTile,
  "100x200": SKU.metroTile,
  "600x600": SKU.floorTile,
};

const tileJob: JobDefinition = {
  type: "tile",
  title: "Tile a wall or floor",
  starter: "Tile a bathroom floor 2.5m x 2m",
  dimensionOrder: (spec) => (spec.options.surface === "floor" ? ["lengthM", "widthM"] : ["lengthM", "heightM"]),
  nextQuestion(spec) {
    if (!spec.options.surface) return q("surface", "Are you tiling walls or a floor?", ["Walls", "Floor"]);
    const floor = spec.options.surface === "floor";
    return askRect(spec, floor ? "widthM" : "heightM", {
      length: floor
        ? q("lengthM", "What size is the floor? For example 2.5m x 2m.", ["2m x 1.8m", "2.5m x 2m", "4 m²"])
        : q("lengthM", "What size is the area to tile? Give me width x height (e.g. 2.4m x 1.2m) or square metres.", [
            "2.4m x 1.2m",
            "1.7m x 2m",
            "6 m²",
          ]),
      second: floor
        ? q("widthM", "And how wide is the floor?", ["1.8m", "2m", "2.5m"])
        : q("heightM", "And how high will the tiling go?", ["1.2m", "2m", "2.4m"]),
    });
  },
  estimate(spec, lookup) {
    const floor = spec.options.surface === "floor";
    const area = rectArea(spec, floor ? "widthM" : "heightM");
    const size = spec.options.tileSize ?? (floor ? "600x600" : "300x600");
    const tileSku = TILE_BY_SIZE[size];
    const diagonal = spec.options.layout === "diagonal";
    const w = waste(spec, diagonal ? 15 : 10);
    const b = new LineBuilder(lookup);
    const ta = b.attr(tileSku);
    const boxCoverage = ta.coverageM2 ?? 1;
    const boxes = ceilQty((area * w.factor) / boxCoverage);
    b.add(
      tileSku,
      boxes,
      `${fmtM2(area)} + ${w.pct}% = ${fmtM2(area * w.factor)} ÷ ${boxCoverage} m² per box → ${boxes}`,
      "materials",
    );
    const adhesiveRate = size === "600x600" ? 5 : size === "100x200" ? 3 : 3.5;
    const bagKg = b.attr(SKU.adhesiveGrey).kg ?? 20;
    const adhesiveKg = area * adhesiveRate;
    b.add(
      SKU.adhesiveGrey,
      ceilQty(adhesiveKg / bagKg),
      `${fmtM2(area)} × about ${adhesiveRate} kg/m² = ${fmtNum(adhesiveKg, 1)} kg ÷ ${bagKg} kg bags`,
      "materials",
    );
    const tw = ta.tileWidthMm ?? 300;
    const th = ta.tileHeightMm ?? 600;
    const tt = ta.tileThicknessMm ?? 8;
    const joint = size === "100x200" ? 2 : 3;
    const groutRate = ((tw + th) / (tw * th)) * tt * joint * 1.6;
    const groutSku = floor ? SKU.groutGrey : SKU.groutWhite;
    const groutKg = area * groutRate * 1.1;
    const groutBag = b.attr(groutSku).kg ?? 5;
    b.add(
      groutSku,
      Math.max(1, ceilQty(groutKg / groutBag)),
      `About ${fmtNum(groutRate, 2)} kg/m² for ${tw} × ${th} mm tiles with ${joint} mm joints = ${fmtNum(groutKg, 1)} kg`,
      "finishing",
    );
    b.add(SKU.spacers, Math.max(1, ceilQty(area / 30)), "One pack of 500 spacers covers about 30 m²", "fixings");
    if (!floor) {
      const edges =
        spec.inputs.lengthM && spec.inputs.heightM ? spec.inputs.lengthM + 2 * spec.inputs.heightM : Math.sqrt(area) * 3;
      const trimLength = b.attr(SKU.tileTrim).lengthM ?? 2.5;
      b.add(SKU.tileTrim, ceilQty(edges / trimLength), `About ${fmtM(edges)} of exposed tile edges`, "finishing", true);
    }
    b.add(SKU.silicone, 1, "Seal joints with baths, trays and worktops", "finishing", true);
    b.add(SKU.notchTrowel, 1, floor ? "10 mm notch for large floor tiles" : "Spreading adhesive evenly", "tools", true);
    b.add(SKU.tileCutter, 1, "Straight cuts up to 600 mm", "tools", true);

    const warnings = floor
      ? ["Large floor tiles need a flat, rigid subfloor — timber floors usually need overboarding with cement backer board first."]
      : ["Inside showers, waterproof (tank) the walls before tiling — a tanking kit isn't included here."];
    return finishEstimate({
      jobType: "tile",
      title: floor ? "Tile a floor" : "Tile a wall",
      summary: `${fmtM2(area)} of ${floor ? "floor" : "wall"} tiling needs ${plural(boxes, "box", "boxes")} of ${tw} × ${th} mm tiles plus adhesive and grout.`,
      measurements: rectMeasurements(spec, floor ? "widthM" : "heightM", area),
      assumptions: [
        `${tw} × ${th} mm tiles, ${boxCoverage} m² per box.`,
        `${w.pct}% extra for cuts${diagonal ? " on a diagonal layout" : ""} and breakages.`,
        `Adhesive at about ${adhesiveRate} kg/m², grout joints of ${joint} mm.`,
        "The surface is sound, flat, dry and primed.",
      ],
      warnings,
      lines: b.lines,
      confidence: "high",
    });
  },
};

const studWallJob: JobDefinition = {
  type: "stud-wall",
  title: "Build a stud partition wall",
  starter: "Build a stud wall 3.6m long and 2.4m high with a door",
  dimensionOrder: () => ["lengthM", "heightM"],
  nextQuestion(spec) {
    if (!spec.inputs.lengthM) return q("lengthM", "How long will the new wall be, in metres?", ["2.4m", "3.6m", "4.5m"]);
    if (!spec.inputs.heightM) return q("heightM", "And how high is it, floor to ceiling?", ["2.4m (standard)", "2.7m", "3m"]);
    return null;
  },
  estimate(spec, lookup) {
    const L = spec.inputs.lengthM ?? 0;
    const H = spec.inputs.heightM ?? 0;
    const doors = spec.inputs.doors ?? 0;
    const studSize = spec.options.studSize ?? (H > 2.7 ? 89 : 63);
    const long = H > 2.4;
    const timberSku =
      studSize === 89 ? (long ? SKU.cls89x30 : SKU.cls89x24) : long ? SKU.cls63x30 : SKU.cls63x24;
    const b = new LineBuilder(lookup);
    const stock = b.attr(timberSku).lengthM ?? (long ? 3 : 2.4);
    const studs = ceilQty(L / 0.6) + 1 + doors * 2;
    const runM = 3 * L + doors;
    const runLengths = ceilQty((runM * 1.1) / stock);
    b.add(
      timberSku,
      studs + runLengths,
      `${studs} studs at 600 mm centres${doors ? ` (including ${doors * 2} around the door)` : ""} + ${fmtNum(runM, 1)} m of plates and noggins (${runLengths} lengths)`,
      "materials",
    );
    const boardType = spec.options.boardType ?? "standard";
    const boardSku = BOARD_SKU[boardType];
    const boardArea = Math.max(0, 2 * (L * H - doors * DOOR_M2));
    const boardCoverage = b.attr(boardSku).coverageM2 ?? 2.88;
    const boards = ceilQty((boardArea * 1.1) / boardCoverage);
    b.add(boardSku, boards, `Both sides: ${fmtM2(boardArea)} + 10% ÷ ${boardCoverage} m² per board → ${boards}`, "materials");
    const insulationArea = Math.max(0, L * H - doors * DOOR_M2);
    const rollCoverage = b.attr(SKU.acousticRoll).coverageM2 ?? 8.64;
    b.add(
      SKU.acousticRoll,
      ceilQty(insulationArea / rollCoverage),
      `${fmtM2(insulationArea)} of cavity ÷ ${rollCoverage} m² per roll — cuts sound between rooms`,
      "materials",
      !spec.options.insulation,
    );
    const perBox = b.attr(SKU.drywallScrews).packQty ?? 1000;
    b.add(SKU.drywallScrews, ceilQty((boards * 30) / perBox), `${boards} boards × about 30 screws`, "fixings");
    const fixings = ceilQty((2 * L) / 0.6) + 2;
    b.add(
      SKU.frameFixings,
      ceilQty(fixings / (b.attr(SKU.frameFixings).packQty ?? 50)),
      `About ${fixings} fixings for the head and sole plates at 600 mm centres`,
      "fixings",
    );
    b.add(SKU.woodScrews, 1, "Fixing studs and noggins to the plates", "fixings");
    addSkimFinish(b, boardArea * 1.1, boardArea);
    b.add(SKU.handSaw, 1, "Cutting studs and noggins", "tools", true);
    b.add(SKU.level, 1, "Keeping studs plumb", "tools", true);

    const warnings = [
      "A non-load-bearing partition usually doesn't need Building Regulations approval, but fire-escape and sound rules can still apply — check before you build.",
    ];
    if (H > 3) warnings.push("Walls over 3 m need longer timber or joined studs — talk to us before ordering.");
    return finishEstimate({
      jobType: "stud-wall",
      title: "Build a stud partition wall",
      summary: `A ${fmtM(L)} × ${fmtM(H)} partition needs ${plural(studs + runLengths, "length")} of CLS timber and ${plural(boards, "board")} for both sides.`,
      measurements: [
        { label: "Length", value: fmtM(L) },
        { label: "Height", value: fmtM(H) },
        ...(doors ? [{ label: "Door openings", value: String(doors) }] : []),
      ],
      assumptions: [
        `${studSize === 89 ? "38 × 89" : "38 × 63"} mm CLS studs at 600 mm centres to suit 1200 mm wide boards.`,
        "Head plate, sole plate and one row of noggins at mid-height.",
        "Plasterboard on both sides, finished with a skim coat.",
        "Plates fixed to masonry with frame fixings — use wood screws instead if fixing into timber joists.",
        spec.options.insulation ? "Acoustic insulation included in the cavity." : "Acoustic insulation is listed as an optional extra.",
      ],
      warnings,
      lines: b.lines,
      confidence: "medium",
    });
  },
};

const fenceJob: JobDefinition = {
  type: "fence",
  title: "Put up a fence",
  starter: "I need 20 metres of 6ft fencing",
  dimensionOrder: () => ["lengthM"],
  nextQuestion: (spec) =>
    spec.inputs.runLengthM ? null : q("runLengthM", "How long is the fence run, in metres?", ["10m", "15m", "20m"]),
  estimate(spec, lookup) {
    const run = spec.inputs.runLengthM ?? 0;
    const height = spec.options.panelHeight ?? "6ft";
    const gravel = spec.options.gravelBoards ?? true;
    const panelSku = height === "5ft" ? SKU.fencePanel5 : SKU.fencePanel6;
    const b = new LineBuilder(lookup);
    const panelWidth = b.attr(panelSku).widthM ?? 1.83;
    const panels = ceilQty(run / panelWidth);
    const posts = panels + 1;
    const postSku = gravel && height === "6ft" ? SKU.post27 : SKU.post24;
    b.add(panelSku, panels, `${fmtM(run)} ÷ ${panelWidth} m per panel = ${fmtNum(run / panelWidth)} → ${panels}`, "materials");
    b.add(postSku, posts, `One more post than panels (${panels} + 1)`, "materials");
    if (gravel) b.add(SKU.gravelBoard, panels, "One under each panel to keep it off the soil", "materials");
    b.add(SKU.postMix, posts * 2, `${posts} posts × 2 bags each`, "materials");
    b.add(
      SKU.panelClips,
      ceilQty((panels * 4) / (b.attr(SKU.panelClips).packQty ?? 8)),
      `4 clips per panel (${panels * 4} clips)`,
      "fixings",
    );
    b.add(SKU.level, 1, "Keeping posts upright", "tools", true);
    b.add(SKU.tapeMeasure, 1, "Setting out post positions", "tools", true);
    return finishEstimate({
      jobType: "fence",
      title: "Put up a fence",
      summary: `${fmtM(run)} of ${height} fencing needs ${plural(panels, "panel")} and ${plural(posts, "post")}.`,
      measurements: [
        { label: "Fence length", value: fmtM(run) },
        { label: "Panel height", value: height === "5ft" ? "5ft (1.52 m)" : "6ft (1.83 m)" },
      ],
      assumptions: [
        `Panels are ${panelWidth} m wide, on a straight run over level ground.`,
        "Posts set about 600 mm into the ground with 2 bags of post mix each.",
        gravel
          ? `Gravel boards add 150 mm of height, so ${height === "6ft" ? "2.7 m posts are used" : "2.4 m posts still work"}.`
          : "No gravel boards — panels sit just above the soil on 2.4 m posts.",
      ],
      warnings: [
        "Fences over 2 m high (or over 1 m next to a road or footpath) may need planning permission.",
        "Check for buried cables and pipes before digging post holes. Each corner or extra run adds one post.",
      ],
      lines: b.lines,
      confidence: "high",
    });
  },
};

const concreteBaseJob: JobDefinition = {
  type: "concrete-base",
  title: "Lay a concrete base",
  starter: "Concrete base for a shed 3m x 2.4m",
  dimensionOrder: () => ["lengthM", "widthM", "depthMm"],
  nextQuestion: (spec) =>
    askRect(spec, "widthM", {
      length: q("lengthM", "What size does the base need to be? For example 3m x 2.4m.", ["2.4m x 1.8m", "3m x 2.4m", "3.6m x 3m"]),
      second: q("widthM", "And how wide is it?", ["1.8m", "2.4m", "3m"]),
    }),
  estimate(spec, lookup) {
    const area = rectArea(spec, "widthM");
    const depthMm = spec.inputs.depthMm ?? 100;
    const volume = area * (depthMm / 1000);
    const withWaste = volume * 1.1;
    const dry = withWaste * 1.54;
    const b = new LineBuilder(lookup);
    const cementKg = (dry / 6) * 1440;
    b.add(
      SKU.cement,
      ceilQty(cementKg / (b.attr(SKU.cement).kg ?? 25)),
      `${fmtM3(withWaste)} of concrete at a 1:5 mix needs about ${fmtNum(cementKg, 0)} kg of cement`,
      "materials",
    );
    const bagT = b.attr(SKU.ballast).bulkBagTonnes ?? 0.85;
    const ballastT = ((dry * 5) / 6) * 1.6;
    b.add(SKU.ballast, ceilQty(ballastT / bagT), `About ${fmtNum(ballastT, 2)} t of all-in ballast ÷ ${bagT} t per bulk bag`, "materials");
    const subBase = spec.options.subBase ?? true;
    if (subBase) {
      const t = area * 0.075 * 2.1;
      b.add(SKU.mot1, ceilQty(t / bagT), `75 mm compacted sub-base ≈ ${fmtNum(t, 2)} t`, "materials");
    }
    if (spec.inputs.lengthM && spec.inputs.widthM) {
      const perimeter = 2 * (spec.inputs.lengthM + spec.inputs.widthM);
      b.add(SKU.c24x48, ceilQty((perimeter * 1.1) / 4.8), `Formwork around the ${fmtM(perimeter)} perimeter`, "materials", true);
    }
    const warnings = ["Don't pour concrete if frost is forecast within 48 hours."];
    if (withWaste > 1.5)
      warnings.unshift("That's over 1.5 m³ — ready-mixed concrete delivered by truck is usually easier and often cheaper.");
    return finishEstimate({
      jobType: "concrete-base",
      title: "Lay a concrete base",
      summary: `A ${depthMm} mm base of ${fmtM2(area)} is about ${fmtM3(volume)} of concrete.`,
      measurements: [...rectMeasurements(spec, "widthM", area), { label: "Depth", value: `${depthMm} mm` }, { label: "Volume", value: fmtM3(volume) }],
      assumptions: [
        `${depthMm} mm slab with 10% extra.`,
        "Mixed 1 part cement to 5 parts all-in ballast (roughly C20 strength).",
        "About 1.54 m³ of dry materials per 1 m³ of finished concrete; bulk bags hold about 850 kg.",
        subBase ? "Laid on 75 mm of compacted MOT Type 1 sub-base." : "No sub-base included.",
      ],
      warnings,
      lines: b.lines,
      confidence: "medium",
    });
  },
};

const patioJob: JobDefinition = {
  type: "patio",
  title: "Lay a patio",
  starter: "Lay a patio 4m x 3m with 600mm slabs",
  dimensionOrder: () => ["lengthM", "widthM"],
  nextQuestion: (spec) =>
    askRect(spec, "widthM", {
      length: q("lengthM", "What size is the patio? For example 4m x 3m.", ["3m x 3m", "4m x 3m", "5m x 4m"]),
      second: q("widthM", "And how wide is it?", ["2.4m", "3m", "3.6m"]),
    }),
  estimate(spec, lookup) {
    const area = rectArea(spec, "widthM");
    const b = new LineBuilder(lookup);
    const slabCoverage = b.attr(SKU.slabBuff).coverageM2 ?? 0.36;
    const slabs = ceilQty((area * 1.05) / slabCoverage);
    b.add(SKU.slabBuff, slabs, `${fmtM2(area)} + 5% for cuts ÷ ${slabCoverage} m² per slab → ${slabs}`, "materials");
    const bagT = b.attr(SKU.mot1).bulkBagTonnes ?? 0.85;
    const subT = area * 0.1 * 2.1;
    b.add(SKU.mot1, ceilQty(subT / bagT), `100 mm compacted sub-base ≈ ${fmtNum(subT, 2)} t`, "materials");
    const bedDry = area * 0.04 * 1.33;
    const sandT = ((bedDry * 6) / 7) * 1.6;
    b.add(SKU.sharpSand, ceilQty(sandT / bagT), `40 mm mortar bed ≈ ${fmtNum(sandT, 2)} t of sharp sand`, "materials");
    const cementKg = (bedDry / 7) * 1440;
    b.add(SKU.cement, ceilQty(cementKg / 25), `6 parts sharp sand to 1 cement ≈ ${fmtNum(cementKg, 0)} kg of cement`, "materials");
    b.add(SKU.membrane, ceilQty(area / (b.attr(SKU.membrane).coverageM2 ?? 14)), "Laid under the sub-base to suppress weeds", "materials", true);
    b.add(SKU.level, 1, "Setting falls and levelling slabs", "tools", true);
    return finishEstimate({
      jobType: "patio",
      title: "Lay a patio",
      summary: `A ${fmtM2(area)} patio needs ${plural(slabs, "slab")} of 600 × 600 mm plus sub-base and bedding mortar.`,
      measurements: rectMeasurements(spec, "widthM", area),
      assumptions: [
        "600 × 600 mm slabs with 10 mm joints and 5% extra for cuts.",
        "100 mm compacted MOT Type 1 sub-base and a full 40 mm mortar bed.",
        "Bulk bags hold about 850 kg.",
      ],
      warnings: [
        "Give the patio a fall of about 1 in 60 away from the house so water drains.",
        "Keep the finished surface at least 150 mm below the house's damp-proof course.",
      ],
      lines: b.lines,
      confidence: "medium",
    });
  },
};

const flooringJob: JobDefinition = {
  type: "flooring",
  title: "Lay laminate flooring",
  starter: "Laminate flooring for a lounge 5m x 4m",
  dimensionOrder: () => ["lengthM", "widthM"],
  nextQuestion: (spec) =>
    askRect(spec, "widthM", {
      length: q("lengthM", "What size is the room? For example 5m x 4m.", ["3m x 3m", "4m x 3.5m", "5m x 4m"]),
      second: q("widthM", "And how wide is the room?", ["3m", "3.5m", "4m"]),
    }),
  estimate(spec, lookup) {
    const area = rectArea(spec, "widthM");
    const w = waste(spec, 10);
    const b = new LineBuilder(lookup);
    const packCoverage = b.attr(SKU.laminate).coverageM2 ?? 2.22;
    const packs = ceilQty((area * w.factor) / packCoverage);
    b.add(SKU.laminate, packs, `${fmtM2(area)} + ${w.pct}% = ${fmtM2(area * w.factor)} ÷ ${packCoverage} m² per pack → ${packs}`, "materials");
    const rollCoverage = b.attr(SKU.underlay).coverageM2 ?? 15;
    b.add(SKU.underlay, ceilQty(area / rollCoverage), `${fmtM2(area)} ÷ ${rollCoverage} m² per roll`, "materials");
    const doors = spec.inputs.doors ?? 1;
    const L = spec.inputs.lengthM;
    const W = spec.inputs.widthM;
    const perimeter = Math.max(0, (L && W ? 2 * (L + W) : Math.sqrt(area) * 4) - doors * 0.9);
    b.add(SKU.scotia, ceilQty((perimeter * 1.1) / 2.4), `About ${fmtM(perimeter)} of skirting edge + 10%`, "finishing");
    b.add(SKU.grabAdhesive, Math.max(1, ceilQty(perimeter / 12)), "Fixes scotia to the skirting (about 12 m per tube)", "fixings");
    b.add(SKU.handSaw, 1, "Cutting boards to length", "tools", true);
    b.add(SKU.tapeMeasure, 1, "Measuring cuts", "tools", true);
    return finishEstimate({
      jobType: "flooring",
      title: "Lay laminate flooring",
      summary: `${fmtM2(area)} of laminate needs ${plural(packs, "pack")} plus underlay and scotia.`,
      measurements: rectMeasurements(spec, "widthM", area),
      assumptions: [
        `${packCoverage} m² per pack with ${w.pct}% extra for cuts.`,
        "Expansion gap around the edge covered by scotia beading.",
        `${plural(doors, "doorway")} left without scotia.`,
      ],
      warnings: [
        "Leave the packs flat in the room for 48 hours before fitting.",
        "On concrete floors use an underlay with a built-in damp-proof membrane.",
      ],
      lines: b.lines,
      confidence: "high",
    });
  },
};

const loftJob: JobDefinition = {
  type: "loft-insulation",
  title: "Insulate a loft",
  starter: "Insulate my loft, it's about 8m x 5m",
  dimensionOrder: () => ["lengthM", "widthM"],
  nextQuestion(spec) {
    const rect = askRect(spec, "widthM", {
      length: q("lengthM", "Roughly what size is the loft floor? For example 8m x 5m.", ["6m x 4m", "8m x 5m", "40 m²"]),
      second: q("widthM", "And how wide is it?", ["4m", "5m", "6m"]),
    });
    if (rect) return rect;
    if (spec.options.existingInsulationMm === undefined)
      return q("existingInsulationMm", "Is there any insulation up there already?", ["None", "About 100mm", "150mm or more"]);
    return null;
  },
  estimate(spec, lookup) {
    const area = rectArea(spec, "widthM");
    const existing = spec.options.existingInsulationMm ?? 0;
    const b = new LineBuilder(lookup);
    const c100 = b.attr(SKU.loft100).coverageM2 ?? 8.3;
    const c170 = b.attr(SKU.loft170).coverageM2 ?? 4.9;
    const covered = area * 1.05;
    let plan: string;
    if (existing < 50) {
      b.add(SKU.loft100, ceilQty(covered / c100), `Between the joists: ${fmtM2(covered)} ÷ ${c100} m² per roll`, "materials");
      b.add(SKU.loft170, ceilQty(covered / c170), `Across the joists: ${fmtM2(covered)} ÷ ${c170} m² per roll`, "materials");
      plan = "100 mm between the joists plus 170 mm across them";
    } else if (existing < 150) {
      b.add(SKU.loft170, ceilQty(covered / c170), `Top-up layer: ${fmtM2(covered)} ÷ ${c170} m² per roll`, "materials");
      plan = "a 170 mm layer across the joists on top of what's there";
    } else if (existing < 250) {
      b.add(SKU.loft100, ceilQty(covered / c100), `Top-up layer: ${fmtM2(covered)} ÷ ${c100} m² per roll`, "materials");
      plan = "a 100 mm top-up layer";
    } else {
      plan = "nothing more — you're already at or near the recommended depth";
    }
    b.add(SKU.knife, 1, "Cutting rolls to length", "tools", true);
    return finishEstimate({
      jobType: "loft-insulation",
      title: "Insulate a loft",
      summary: `To reach about 270 mm over ${fmtM2(area)} you need ${plan}.`,
      measurements: [...rectMeasurements(spec, "widthM", area), { label: "Existing insulation", value: existing ? `${existing} mm` : "None" }],
      assumptions: [
        "Recommended total depth is about 270 mm of mineral wool.",
        `Plan: ${plan}.`,
        "5% extra for trimming around joists, pipes and hatches.",
      ],
      warnings: [
        "Keep the eaves clear so the roof space stays ventilated.",
        "Don't cover recessed downlights unless they're fire-rated with insulation guards fitted.",
        "Wear gloves, long sleeves and a dust mask when handling mineral wool.",
      ],
      lines: b.lines,
      confidence: "medium",
    });
  },
};

export const JOBS: Record<JobType, JobDefinition> = {
  plasterboard: plasterboardJob,
  skim: skimJob,
  paint: paintJob,
  tile: tileJob,
  "stud-wall": studWallJob,
  fence: fenceJob,
  "concrete-base": concreteBaseJob,
  patio: patioJob,
  flooring: flooringJob,
  "loft-insulation": loftJob,
};

export const JOB_LIST: JobDefinition[] = Object.values(JOBS);
