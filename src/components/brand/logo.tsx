import { cn } from "@/lib/cn";

/** The Tradepal mark: a "T" built from a board and a post, with a tick for "sorted". */
export function LogoMark({ className, title, inverted = false }: { className?: string; title?: string; inverted?: boolean }) {
  const bg = inverted ? "#FFFFFF" : "#1769D2";
  const fg = inverted ? "#1769D2" : "#FFFFFF";
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect width="64" height="64" rx="15" fill={bg} />
      <rect x="13" y="14" width="38" height="10" rx="3" fill={fg} />
      <rect x="25" y="27" width="10" height="24" rx="3" fill={fg} />
      <path d="M40 42.5 44.75 47.25 53 39" fill="none" stroke={fg} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ className, tone = "default" }: { className?: string; tone?: "default" | "white" }) {
  return (
    <span className={cn("font-display font-extrabold tracking-tight", tone === "white" ? "text-white" : "text-ink-900", className)}>
      Trade<span className={tone === "white" ? "text-brand-200" : "text-brand-500"}>pal</span>
    </span>
  );
}

export function Logo({ className, tone = "default", size = "md" }: { className?: string; tone?: "default" | "white"; size?: "sm" | "md" | "lg" }) {
  const mark = { sm: "size-7", md: "size-8", lg: "size-12" }[size];
  const text = { sm: "text-lg", md: "text-[1.35rem]", lg: "text-4xl" }[size];
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={cn(mark, "shrink-0")} inverted={tone === "white"} />
      <Wordmark className={text} tone={tone} />
    </span>
  );
}
