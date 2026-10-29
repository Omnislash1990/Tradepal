"use client";

import { Menu, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Logo } from "@/components/brand/logo";
import { SearchForm } from "@/components/layout/search-form";
import { ButtonLink } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/catalog/categories";
import { CATEGORY_ICONS } from "@/lib/catalog/icons";

export function MobileNav({ signedIn, isStaff }: { signedIn: boolean; isStaff: boolean }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const menuId = useId();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const menu = open ? (
    <div id={menuId} className="fixed inset-0 z-[100] flex flex-col bg-white" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
        <Logo size="sm" />
        <button type="button" className="grid size-11 place-items-center rounded-xl hover:bg-mist" onClick={() => setOpen(false)}>
          <X className="size-6" />
          <span className="sr-only">Close menu</span>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <SearchForm id="mobile-search" />
        <ButtonLink href="/assistant" className="mt-4 w-full" onClick={() => setOpen(false)}>
          <Sparkles className="size-4" />
          AI assistant
        </ButtonLink>
        <nav className="mt-6">
          <p className="text-xs font-bold tracking-wide text-ink-500 uppercase">Categories</p>
          <ul className="mt-2 grid grid-cols-2 gap-1">
            {CATEGORIES.map((c) => {
              const Icon = CATEGORY_ICONS[c.icon];
              return (
                <li key={c.slug}>
                  <Link
                    href={`/c/${c.slug}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-2 py-2.5 text-sm font-medium hover:bg-mist"
                  >
                    {Icon && <Icon className="size-4 text-brand-600" />}
                    {c.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="mt-6 flex flex-col gap-2 border-t border-ink-100 pt-4 pb-8">
          <Link href={signedIn ? "/account" : "/login"} onClick={() => setOpen(false)} className="rounded-xl px-2 py-2 font-semibold hover:bg-mist">
            {signedIn ? "My account" : "Sign in"}
          </Link>
          <Link href="/trade" onClick={() => setOpen(false)} className="rounded-xl px-2 py-2 font-semibold hover:bg-mist">
            Trade account
          </Link>
          <Link href="/help" onClick={() => setOpen(false)} className="rounded-xl px-2 py-2 font-semibold hover:bg-mist">
            Help
          </Link>
          {isStaff && (
            <Link href="/admin" onClick={() => setOpen(false)} className="rounded-xl px-2 py-2 font-semibold text-brand-700 hover:bg-mist">
              Admin
            </Link>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="lg:hidden">
      <button
        type="button"
        className="grid size-11 place-items-center rounded-xl text-ink-800 hover:bg-mist"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="size-6" /> : <Menu className="size-6" />}
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
      </button>
      {mounted ? createPortal(menu, document.body) : null}
    </div>
  );
}
