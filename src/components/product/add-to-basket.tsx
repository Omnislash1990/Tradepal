"use client";

import { Check, Minus, Plus, ShoppingBasket } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { addToBasketAction } from "@/app/actions/basket";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/cn";

export function QuantityStepper({
  value,
  onChange,
  name,
  min = 1,
  max = 999,
  label = "Quantity",
  size = "md",
}: {
  value: number;
  onChange: (n: number) => void;
  name?: string;
  min?: number;
  max?: number;
  label?: string;
  size?: "sm" | "md";
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, Number.isFinite(n) ? Math.round(n) : min));
  const h = size === "sm" ? "h-9" : "h-11";
  return (
    <div className={cn("inline-flex items-stretch overflow-hidden rounded-xl bg-white ring-1 ring-ink-300 ring-inset", h)}>
      <button
        type="button"
        className="grid w-10 place-items-center text-ink-700 hover:bg-mist disabled:opacity-40"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        aria-label={`Decrease ${label.toLowerCase()}`}
      >
        <Minus className="size-4" />
      </button>
      <input
        name={name}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        aria-label={label}
        className="w-12 border-x border-ink-200 bg-transparent text-center font-semibold text-ink-900 focus:outline-none"
      />
      <button
        type="button"
        className="grid w-10 place-items-center text-ink-700 hover:bg-mist disabled:opacity-40"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        aria-label={`Increase ${label.toLowerCase()}`}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

export function AddToBasket({
  productId,
  productName,
  disabled,
  compact = false,
  initialQuantity = 1,
}: {
  productId: string;
  productName: string;
  disabled?: boolean;
  compact?: boolean;
  initialQuantity?: number;
}) {
  const [state, action] = useActionState(addToBasketAction, null);
  const [quantity, setQuantity] = useState(initialQuantity);

  if (compact) {
    return (
      <form action={action} className="flex items-center gap-2">
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="quantity" value={1} />
        <SubmitButton
          size="sm"
          variant={state?.ok ? "secondary" : "primary"}
          disabled={disabled}
          className="w-full"
          aria-label={`Add ${productName} to basket`}
        >
          {state?.ok ? <Check className="size-4" aria-hidden /> : <ShoppingBasket className="size-4" aria-hidden />}
          {disabled ? "Unavailable" : state?.ok ? "Added" : "Add"}
        </SubmitButton>
        <span className="sr-only" role="status">
          {state?.message}
        </span>
      </form>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="productId" value={productId} />
      <div className="flex flex-wrap items-center gap-3">
        <QuantityStepper value={quantity} onChange={setQuantity} name="quantity" />
        <SubmitButton size="md" disabled={disabled} className="min-w-44 flex-1" pendingText="Adding…">
          <ShoppingBasket className="size-5" aria-hidden />
          {disabled ? "Currently unavailable" : "Add to basket"}
        </SubmitButton>
      </div>
      <div role="status" aria-live="polite" className="min-h-5 text-sm">
        {state && (
          <span className={state.ok ? "font-medium text-success-700" : "text-danger-700"}>
            {state.message}
            {state.ok && (
              <>
                {" — "}
                <Link href="/basket" className="font-semibold text-brand-600 underline-offset-2 hover:underline">
                  view basket
                </Link>
              </>
            )}
          </span>
        )}
      </div>
    </form>
  );
}
