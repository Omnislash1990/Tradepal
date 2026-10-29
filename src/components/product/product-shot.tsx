"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { productPhotoSrc } from "@/lib/catalog/photos";
import { ProductPhoto } from "./product-photo";

export function ProductShot({
  imageKey,
  name,
  alt,
  className,
}: {
  imageKey: string;
  name: string;
  alt?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <ProductPhoto imageKey={imageKey} name={name} className={className} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- local pack shots plus optional supplier URLs
    <img
      src={productPhotoSrc(imageKey, name)}
      alt={alt || name}
      onError={() => setFailed(true)}
      className={cn("aspect-square rounded-xl bg-[#eef2f6] object-cover", className)}
    />
  );
}
