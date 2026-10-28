import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Container({ className, width = "default", ...props }: ComponentProps<"div"> & { width?: "default" | "wide" | "narrow" }) {
  const max = { default: "max-w-7xl", wide: "max-w-[90rem]", narrow: "max-w-3xl" }[width];
  return <div className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", max, className)} {...props} />;
}
