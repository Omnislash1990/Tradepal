import {
  Bath,
  Bolt,
  Box,
  BrickWall,
  BrushCleaning,
  Cable,
  CircleDot,
  Columns3,
  CornerDownRight,
  Cylinder,
  Disc,
  Drill,
  Droplet,
  Droplets,
  Fence,
  Grid2x2,
  Grid3x3,
  Hammer,
  Heater,
  Layers,
  Layers2,
  Lightbulb,
  Minus,
  Package,
  PackageOpen,
  PaintBucket,
  PaintRoller,
  Paintbrush,
  PanelTop,
  Plug,
  Plus,
  RectangleHorizontal,
  RectangleVertical,
  Rows3,
  Ruler,
  Scissors,
  ShowerHead,
  Shovel,
  Slice,
  Square,
  SquareStack,
  Syringe,
  Thermometer,
  Toilet,
  ToggleLeft,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ImageKey } from "@/lib/catalog/types";
import { cn } from "@/lib/cn";

const ICONS: Record<ImageKey, LucideIcon> = {
  board: Layers,
  sheet: RectangleHorizontal,
  bag: Package,
  "bulk-bag": PackageOpen,
  timber: Columns3,
  trim: Minus,
  tape: Disc,
  tub: Cylinder,
  screws: Bolt,
  plugs: Plus,
  pipe: Minus,
  fitting: CornerDownRight,
  valve: CircleDot,
  radiator: Heater,
  cable: Cable,
  socket: Plug,
  switch: ToggleLeft,
  downlight: Lightbulb,
  "consumer-unit": Zap,
  junction: Box,
  drill: Drill,
  saw: Slice,
  "tape-measure": Ruler,
  level: Ruler,
  trowel: Shovel,
  knife: Slice,
  hammer: Hammer,
  "tile-cutter": Scissors,
  toilet: Toilet,
  basin: Droplet,
  tap: Droplets,
  shower: ShowerHead,
  tray: Square,
  screen: PanelTop,
  bath: Bath,
  paint: PaintBucket,
  roller: PaintRoller,
  brush: Paintbrush,
  "dust-sheet": BrushCleaning,
  cartridge: Syringe,
  sandpaper: Square,
  tile: Grid2x2,
  mosaic: Grid3x3,
  spacers: Plus,
  laminate: Rows3,
  underlay: Layers2,
  block: Box,
  brick: BrickWall,
  lintel: RectangleHorizontal,
  insulation: Thermometer,
  "fence-panel": Fence,
  post: RectangleVertical,
  slab: SquareStack,
  membrane: Layers,
};

const TINTS: Record<string, string> = {
  "plasterboard-plaster": "from-slate-50 to-slate-200 text-slate-700",
  "timber-sheet": "from-amber-50 to-amber-100 text-amber-800",
  "building-materials": "from-stone-50 to-stone-200 text-stone-700",
  insulation: "from-rose-50 to-rose-100 text-rose-700",
  "plumbing-heating": "from-cyan-50 to-cyan-100 text-cyan-800",
  electrical: "from-yellow-50 to-yellow-100 text-yellow-800",
  tools: "from-orange-50 to-orange-100 text-orange-800",
  bathrooms: "from-teal-50 to-teal-100 text-teal-800",
  decorating: "from-violet-50 to-violet-100 text-violet-800",
  "tiling-flooring": "from-indigo-50 to-indigo-100 text-indigo-800",
  "fixings-adhesives": "from-zinc-50 to-zinc-200 text-zinc-700",
  "landscaping-fencing": "from-green-50 to-green-100 text-green-800",
};

/** Illustrated placeholder used until real product photography is supplied. */
export function ProductArt({
  imageKey,
  categorySlug,
  imageUrl,
  alt,
  className,
}: {
  imageKey: string;
  categorySlug: string;
  imageUrl?: string | null;
  alt?: string;
  className?: string;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- supplier image URLs are arbitrary hosts
      <img src={imageUrl} alt={alt ?? ""} className={cn("aspect-square rounded-xl bg-white object-contain", className)} />
    );
  }
  const Icon = ICONS[imageKey as ImageKey] ?? Package;
  return (
    <div
      className={cn(
        "relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-linear-to-br",
        TINTS[categorySlug] ?? "from-mist to-mist-dark text-ink-700",
        className,
      )}
    >
      <div className="absolute -right-6 -bottom-6 size-2/5 rounded-full bg-white/40" aria-hidden />
      <Icon className="relative size-[42%]" strokeWidth={1.25} aria-hidden />
    </div>
  );
}
