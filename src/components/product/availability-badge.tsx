import { CircleCheck, Clock, CircleAlert, CircleX } from "lucide-react";
import { cn } from "@/lib/cn";

export type AvailabilityStatus = "in_stock" | "low_stock" | "unverified" | "out_of_stock";

const STYLES: Record<AvailabilityStatus, { className: string; Icon: typeof CircleCheck }> = {
  in_stock: { className: "text-success-700", Icon: CircleCheck },
  low_stock: { className: "text-warning-700", Icon: CircleAlert },
  unverified: { className: "text-ink-600", Icon: Clock },
  out_of_stock: { className: "text-danger-700", Icon: CircleX },
};

export function AvailabilityBadge({ status, label, className }: { status: AvailabilityStatus; label: string; className?: string }) {
  const { className: tone, Icon } = STYLES[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", tone, className)}>
      <Icon className="size-4 shrink-0" aria-hidden />
      {label}
    </span>
  );
}
