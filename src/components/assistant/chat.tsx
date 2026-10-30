"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { addItemsAction } from "@/app/actions/basket";
import { assistantTurnAction } from "@/app/actions/assistant";
import { ProductArt } from "@/components/product/product-art";
import { Button } from "@/components/ui/button";
import { formatGBP } from "@/lib/domain/money";
import { JOB_STARTERS, type AssistantState } from "@/lib/domain/assistant/engine";
import type { AssistantTurn, EstimateView, ProductSummary } from "@/lib/server/assistant";
import { cn } from "@/lib/cn";

type Message = { role: "user" | "assistant"; text: string; turn?: AssistantTurn };

export function AssistantChat({ initialQuery = "" }: { initialQuery?: string }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Tell me what you're working on — a wall to board, a room to paint, fencing, a shed base — and I'll estimate the materials. Quantities are a guide; you can edit everything before you buy.",
    },
  ]);
  const [state, setState] = useState<AssistantState>({ job: null, awaiting: null });
  const [input, setInput] = useState("");
  const [pending, start] = useTransition();
  const [added, setAdded] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const startedInitial = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setInput("");
    setAdded(null);
    setMessages((m) => [...m, { role: "user", text: message }]);
    start(async () => {
      try {
        const turn = await assistantTurnAction(message, stateRef.current);
        if (!turn?.reply) throw new Error("empty assistant reply");
        setState(turn.state);
        setMessages((m) => [...m, { role: "assistant", text: turn.reply.text, turn }]);
      } catch (err) {
        console.error("[assistant chat]", err);
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text: "I couldn't finish that just now. Please try again, or browse the catalogue.",
          },
        ]);
      }
      queueMicrotask(() => bottom.current?.scrollIntoView({ behavior: "smooth" }));
    });
  }

  useEffect(() => {
    if (!initialQuery || startedInitial.current) return;
    startedInitial.current = true;
    send(initialQuery);
    // Initial URL query is sent once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const lastEstimate = [...messages].reverse().find((m) => m.turn?.reply.estimate)?.turn?.reply.estimate ?? null;
  const lastProducts = [...messages].reverse().find((m) => m.turn && m.turn.products.length > 0)?.turn?.products ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-h-[70vh] flex-col rounded-2xl bg-white shadow-card ring-1 ring-ink-200">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[90%] rounded-2xl px-4 py-3 text-[0.95rem] leading-relaxed whitespace-pre-wrap",
                  m.role === "user" ? "bg-brand-500 text-white" : "bg-mist text-ink-900",
                )}
              >
                {m.role === "assistant" && (
                  <Sparkles className="mb-1 inline size-4 text-brand-600" aria-hidden />
                )}{" "}
                {m.text}
              </div>
            </div>
          ))}
          {pending && <p className="text-sm text-ink-500">Working that out…</p>}
          <div ref={bottom} />
        </div>
        <div className="border-t border-ink-100 p-3 sm:p-4">
          {messages.length < 3 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {JOB_STARTERS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-100"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2"
          >
            <label htmlFor="assistant-input" className="sr-only">
              Describe your job
            </label>
            <input
              id="assistant-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={500}
              placeholder="e.g. plasterboard a 4.2m × 2.4m wall"
              className="h-12 flex-1 rounded-xl bg-white px-4 ring-1 ring-ink-300 focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
            <Button type="submit" disabled={pending || !input.trim()}>
              Send
            </Button>
          </form>
          <p className="mt-2 text-xs text-ink-500">Estimates include typical waste allowances. Check your site before ordering.</p>
        </div>
      </div>
      <aside className="space-y-4">
        {lastEstimate && <EstimateCard estimate={lastEstimate} added={added} onAdded={setAdded} />}
        {lastProducts.length > 0 && <ProductHits products={lastProducts} />}
      </aside>
    </div>
  );
}

function EstimateCard({ estimate, added, onAdded }: { estimate: EstimateView; added: string | null; onAdded: (m: string) => void }) {
  const items = estimate.lines.filter((l) => l.product && !l.optional && l.available);
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-ink-200">
      <p className="text-xs font-bold tracking-wide text-brand-600 uppercase">Material estimate</p>
      <h2 className="mt-1 font-bold">{estimate.title}</h2>
      <p className="mt-1 text-sm text-ink-600">{estimate.summary}</p>
      <p className="mt-3 font-display text-2xl font-extrabold">{formatGBP(estimate.totalGross)}</p>
      <p className="text-xs text-ink-500">inc VAT · {estimate.confidence} confidence</p>
      <ul className="mt-3 space-y-2 text-sm">
        {estimate.lines.map((l) => (
          <li key={l.sku} className={cn("flex justify-between gap-2", !l.available && "text-ink-400")}>
            <span>
              {l.quantity} × {l.name}
              {l.optional && <span className="text-ink-400"> (optional)</span>}
            </span>
            <span className="shrink-0 font-medium">{formatGBP(l.unitGross * l.quantity)}</span>
          </li>
        ))}
      </ul>
      {estimate.assumptions.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-semibold">Assumptions</summary>
          <ul className="mt-1 list-disc pl-4 text-ink-600">
            {estimate.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </details>
      )}
      {estimate.warnings.length > 0 && (
        <ul className="mt-2 list-disc pl-4 text-sm text-warning-700">
          {estimate.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      {items.length > 0 && (
        <Button
          className="mt-4 w-full"
          disabled={!!added}
          onClick={async () => {
            const result = await addItemsAction(
              items.map((l) => ({ productId: l.product!.id, quantity: l.quantity })),
              "assistant",
            );
            onAdded(result?.message ?? "Added");
          }}
        >
          {added ?? "Add list to basket"}
        </Button>
      )}
    </div>
  );
}

function ProductHits({ products }: { products: ProductSummary[] }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-ink-200">
      <p className="text-xs font-bold tracking-wide text-ink-500 uppercase">Matching products</p>
      <ul className="mt-3 space-y-3">
        {products.map((p) => (
          <li key={p.id} className="flex gap-3">
            <ProductArt imageKey={p.imageKey} name={p.name} className="size-14 shrink-0" />
            <div>
              <Link href={`/products/${p.slug}`} className="text-sm font-semibold hover:text-brand-700">
                {p.name}
              </Link>
              <p className="text-sm text-ink-600">{formatGBP(p.unitGross)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
