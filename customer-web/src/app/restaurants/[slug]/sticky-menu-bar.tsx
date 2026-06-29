"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ShoppingBag, Sparkles } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { Container } from "@/components/section";
import { cn } from "@/lib/utils";

interface StickyMenuBarProps {
  /** [{ id: anchor id, label: category name }] derived from the menu */
  categories: { id: string; label: string }[];
  accent: string;
}

/**
 * Sticky sub-bar under the global navbar: smooth-scroll category chips,
 * a reassuring "your bundle stays put" line, and a live cart button.
 */
export function StickyMenuBar({ categories, accent }: StickyMenuBarProps) {
  const { itemCount, openCart, hydrated, justAdded } = useCart();
  const reduce = useReducedMotion();
  const [active, setActive] = useState<string>(categories[0]?.id ?? "");

  // Highlight the category nearest the top of the viewport.
  useEffect(() => {
    if (categories.length === 0) return;
    const sections = categories
      .map((c) => document.getElementById(c.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-160px 0px -65% 0px", threshold: 0 },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [categories]);

  const handleJump = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    setActive(id);
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    <div className="glass sticky top-16 z-30 border-b border-border/70">
      <Container className="flex h-14 items-center gap-3">
        {/* category chips */}
        <nav
          aria-label="Menu sections"
          className="marquee-mask -mx-1 flex flex-1 items-center gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {categories.map((c) => {
            const isActive = active === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleJump(c.id)}
                aria-current={isActive ? "true" : undefined}
                style={isActive ? { backgroundColor: accent } : undefined}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-[0.8125rem] font-semibold transition-colors",
                  isActive
                    ? "text-white shadow-sm"
                    : "bg-white/70 text-foreground/80 ring-1 ring-inset ring-border hover:text-primary",
                )}
              >
                {c.label}
              </button>
            );
          })}
        </nav>

        {/* reassurance + cart */}
        <span className="hidden shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground lg:flex">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Keep browsing — your bundle stays put
        </span>

        <motion.button
          type="button"
          onClick={openCart}
          key={justAdded}
          animate={!reduce && justAdded ? { scale: [1, 1.12, 1] } : {}}
          transition={{ duration: 0.3 }}
          className="relative flex shrink-0 items-center gap-2 rounded-full bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-[0_8px_20px_-6px_rgba(232,67,31,0.5)] transition hover:-translate-y-0.5 hover:bg-primary-bright"
        >
          <ShoppingBag className="h-4 w-4" />
          <span className="hidden sm:inline">View bundle</span>
          {hydrated && itemCount > 0 && (
            <span className="tnum grid h-5 min-w-5 place-items-center rounded-full bg-accent-alt px-1 text-[11px] font-bold text-white ring-2 ring-primary">
              {itemCount}
            </span>
          )}
        </motion.button>
      </Container>
    </div>
  );
}
