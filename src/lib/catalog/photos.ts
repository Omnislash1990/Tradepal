/** Local pack-shot filename (without extension) for a catalogue item. */
export function productPhotoSlug(imageKey: string, name = ""): string {
  const t = name.toLowerCase();
  switch (imageKey) {
    case "board":
      if (t.includes("moisture")) return "board-moisture";
      if (t.includes("fire")) return "board-fire";
      if (t.includes("acoustic")) return "board-acoustic";
      if (t.includes("backer")) return "board-backer";
      return "board";
    case "sheet":
      if (t.includes("osb")) return "sheet-osb";
      if (t.includes("plywood") || t.includes("ply ")) return "sheet-plywood";
      if (t.includes("mdf")) return "sheet-mdf";
      if (t.includes("pir")) return "sheet-pir";
      return "sheet";
    case "bag":
      if (t.includes("cement") || t.includes("post mix")) return "bag-cement";
      if (t.includes("grout")) return t.includes("white") ? "bag-grout-white" : "bag-grout";
      if (t.includes("adhesive")) return t.includes("white") ? "bag-grout-white" : "bag-adhesive";
      if (t.includes("plaster")) return "bag-plaster";
      return "bag";
    case "paint":
      return t.includes("magnolia") ? "paint-magnolia" : "paint";
    case "tile":
      return t.includes("grey") || t.includes("porcelain") ? "tile-grey" : "tile";
    case "mosaic":
      return "tile-metro";
    case "slab":
      return t.includes("buff") ? "slab-buff" : "slab";
    case "pipe":
      return t.includes("copper") ? "pipe-copper" : "pipe";
    case "insulation":
      return t.includes("pir") ? "sheet-pir" : "insulation";
    case "trowel":
      return t.includes("hawk") ? "hawk" : "trowel";
    default:
      return imageKey;
  }
}

export function productPhotoSrc(imageKey: string, name = ""): string {
  return `/products/${productPhotoSlug(imageKey, name)}.jpg`;
}
