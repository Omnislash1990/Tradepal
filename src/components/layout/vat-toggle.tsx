import { setVatModeAction } from "@/app/actions/basket";
import { cn } from "@/lib/cn";

export function VatToggle({ exVat }: { exVat: boolean }) {
  return (
    <form action={setVatModeAction} className="inline-flex rounded-lg bg-mist p-0.5 text-xs font-semibold">
      <input type="hidden" name="mode" value={exVat ? "inc" : "ex"} />
      <button
        type="submit"
        className={cn("rounded-md px-2.5 py-1", !exVat ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800")}
        aria-pressed={!exVat}
      >
        Inc VAT
      </button>
      <button
        type="submit"
        name="mode"
        value="ex"
        className={cn("rounded-md px-2.5 py-1", exVat ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800")}
        aria-pressed={exVat}
      >
        Ex VAT
      </button>
    </form>
  );
}
