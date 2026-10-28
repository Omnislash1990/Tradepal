import { formatGBP } from "@/lib/domain/money";
import { netFromGross } from "@/lib/domain/vat";
import { cn } from "@/lib/cn";

/**
 * Shows the price the customer pays with the other VAT basis underneath, so it's always clear
 * whether VAT is included.
 */
export function Price({
  gross,
  vatBps,
  exVat,
  regularGross,
  kind,
  unit,
  size = "md",
  className,
}: {
  gross: number;
  vatBps: number;
  exVat: boolean;
  regularGross?: number;
  kind?: "regular" | "promo" | "trade";
  unit?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const net = netFromGross(gross, vatBps);
  const main = exVat ? net : gross;
  const wasGross = regularGross && regularGross > gross ? regularGross : null;
  const was = wasGross ? (exVat ? netFromGross(wasGross, vatBps) : wasGross) : null;
  const sizes = { sm: "text-lg", md: "text-xl", lg: "text-3xl" };
  return (
    <div className={className}>
      <div className="flex flex-wrap items-baseline gap-x-1.5">
        <span className={cn("font-display font-extrabold text-ink-900", sizes[size], kind === "promo" && "text-danger-700")}>
          {formatGBP(main)}
        </span>
        <span className="text-xs font-medium text-ink-500">
          {vatBps === 0 ? "no VAT" : exVat ? "ex VAT" : "inc VAT"}
          {unit && ` / ${unit}`}
        </span>
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-500">
        {vatBps > 0 && <span>{exVat ? `${formatGBP(gross)} inc VAT` : `${formatGBP(net)} ex VAT`}</span>}
        {was && (
          <span>
            <span className="sr-only">Was </span>
            <s>{formatGBP(was)}</s>
            {kind === "trade" && <span className="ml-1 font-semibold text-brand-700">Trade price</span>}
          </span>
        )}
      </div>
    </div>
  );
}
