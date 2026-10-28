export type ProductAttributes = {
  /** Area covered by one unit (board, box, pack, roll, slab). */
  coverageM2?: number;
  /** Length of one unit (timber, pipe, tape roll, trim). */
  lengthM?: number;
  widthM?: number;
  heightM?: number;
  litres?: number;
  /** Paint spread rate per coat. */
  coverageM2PerLitre?: number;
  kg?: number;
  packQty?: number;
  thicknessMm?: number;
  tileWidthMm?: number;
  tileHeightMm?: number;
  tileThicknessMm?: number;
  bulkBagTonnes?: number;
};

export type ImageKey =
  | "board" | "sheet" | "bag" | "bulk-bag" | "timber" | "trim" | "tape" | "tub" | "screws" | "plugs"
  | "pipe" | "fitting" | "valve" | "radiator" | "cable" | "socket" | "switch" | "downlight"
  | "consumer-unit" | "junction" | "drill" | "saw" | "tape-measure" | "level" | "trowel" | "knife"
  | "hammer" | "tile-cutter" | "toilet" | "basin" | "tap" | "shower" | "tray" | "screen" | "bath"
  | "paint" | "roller" | "brush" | "dust-sheet" | "cartridge" | "sandpaper" | "tile" | "mosaic"
  | "spacers" | "laminate" | "underlay" | "block" | "brick" | "lintel" | "insulation" | "fence-panel"
  | "post" | "slab" | "membrane";
