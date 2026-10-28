export const CATEGORIES = [
  {
    slug: "plasterboard-plaster",
    name: "Plasterboard & Plaster",
    icon: "Layers",
    description: "Standard, moisture-resistant, fire and acoustic boards, finishing plaster, undercoats and beads.",
  },
  {
    slug: "timber-sheet",
    name: "Timber & Sheet Materials",
    icon: "TreePine",
    description: "CLS studwork, structural and treated timber, OSB, plywood, MDF, mouldings and decking.",
  },
  {
    slug: "building-materials",
    name: "Building Materials",
    icon: "BrickWall",
    description: "Cement, bulk bag aggregates, blocks, bricks, lintels and damp proofing.",
  },
  {
    slug: "insulation",
    name: "Insulation",
    icon: "Thermometer",
    description: "Loft rolls, acoustic partition roll and PIR boards.",
  },
  {
    slug: "plumbing-heating",
    name: "Plumbing & Heating",
    icon: "Droplets",
    description: "Copper and plastic pipe, fittings, valves, waste and radiators.",
  },
  {
    slug: "electrical",
    name: "Electrical",
    icon: "Zap",
    description: "Cable, sockets, switches, back boxes, downlights and consumer units.",
  },
  {
    slug: "tools",
    name: "Tools",
    icon: "Hammer",
    description: "Power tools, hand tools, plastering and tiling tools.",
  },
  {
    slug: "bathrooms",
    name: "Bathrooms",
    icon: "Bath",
    description: "Toilets, basins, taps, showers, trays, screens and baths.",
  },
  {
    slug: "decorating",
    name: "Decorating",
    icon: "PaintRoller",
    description: "Emulsion, woodwork paint, rollers, brushes and preparation.",
  },
  {
    slug: "tiling-flooring",
    name: "Tiling & Flooring",
    icon: "Grid2x2",
    description: "Wall and floor tiles, adhesive, grout, trims, laminate and underlay.",
  },
  {
    slug: "fixings-adhesives",
    name: "Fixings & Adhesives",
    icon: "Bolt",
    description: "Screws, frame fixings, nails, plugs, adhesives, sealants and foam.",
  },
  {
    slug: "landscaping-fencing",
    name: "Landscaping & Fencing",
    icon: "Fence",
    description: "Fence panels, posts, gravel boards, post mix, paving slabs and membrane.",
  },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];
