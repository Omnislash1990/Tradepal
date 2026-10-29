import { cn } from "@/lib/cn";
import { ProductPhoto } from "./product-photo";

/** Studio product shot. Uses a supplier photo when `imageUrl` is set. */
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
  return <ProductPhoto imageKey={imageKey} name={name || alt || ""} className={className} />;
}
