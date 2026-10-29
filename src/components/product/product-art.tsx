import { cn } from "@/lib/cn";
import { ProductShot } from "./product-shot";

/** Product photography. Uses a supplier URL when set, otherwise the local pack shot. */
export function ProductArt({
  imageKey,
  imageUrl,
  alt,
  name,
  className,
}: {
  imageKey: string;
  categorySlug?: string;
  imageUrl?: string | null;
  alt?: string;
  name?: string;
  className?: string;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- supplier image URLs are arbitrary hosts
      <img src={imageUrl} alt={alt ?? name ?? ""} className={cn("aspect-square rounded-xl bg-white object-contain", className)} />
    );
  }
  return <ProductShot imageKey={imageKey} name={name || alt || ""} alt={alt ?? name} className={className} />;
}
