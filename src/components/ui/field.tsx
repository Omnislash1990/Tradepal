import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "block w-full rounded-xl border-0 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink-900 shadow-sm ring-1 ring-inset ring-ink-300 placeholder:text-ink-400 focus:ring-2 focus:ring-inset focus:ring-brand-500 focus:outline-none disabled:bg-mist disabled:text-ink-500 aria-invalid:ring-danger-600";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("mb-1.5 block text-sm font-semibold text-ink-800", className)} {...props} />;
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-24", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, "h-11 pr-9", className)} {...props} />;
}

export function Hint({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("mt-1.5 text-sm text-ink-500", className)} {...props} />;
}

export function FieldError({ children, id }: { children?: ReactNode; id?: string }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-sm font-medium text-danger-600">
      {children}
    </p>
  );
}

export function Field({
  label,
  name,
  hint,
  error,
  className,
  children,
}: {
  label: ReactNode;
  name: string;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={name}>{label}</Label>
      {children}
      {hint && !error && <Hint>{hint}</Hint>}
      <FieldError id={`${name}-error`}>{error}</FieldError>
    </div>
  );
}

export function Checkbox({ label, className, ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 text-[0.95rem] text-ink-800", className)}>
      <input
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 cursor-pointer rounded-md border-ink-300 accent-brand-500"
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}

export function FormMessage({ tone = "error", children }: { tone?: "error" | "success" | "info"; children?: ReactNode }) {
  if (!children) return null;
  const tones = {
    error: "bg-danger-50 text-danger-700 ring-danger-600/20",
    success: "bg-success-50 text-success-700 ring-success-600/20",
    info: "bg-brand-50 text-brand-800 ring-brand-500/20",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-xl px-4 py-3 text-sm font-medium ring-1 ring-inset", tones[tone])}>
      {children}
    </div>
  );
}
