"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check } from "lucide-react";
import type { CuratedBundle } from "@/lib/types";
import { BundleCard } from "@/components/bundle-card";
import { cn } from "@/lib/utils";

const ALL = "All";

export function BundleGrid({ bundles }: { bundles: CuratedBundle[] }) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState<string>(ALL);

  const themes = useMemo(() => {
    const seen: string[] = [];
    for (const b of bundles) if (!seen.includes(b.theme)) seen.push(b.theme);
    return [ALL, ...seen];
  }, [bundles]);

  const visible = useMemo(
    () => (active === ALL ? bundles : bundles.filter((b) => b.theme === active)),
    [bundles, active],
  );

  return (
    <div>
      {/* theme filter chips */}
      <div
        role="tablist"
        aria-label="Filter bundles by theme"
        className="flex flex-wrap items-center gap-2.5"
      >
        {themes.map((theme) => {
          const isActive = theme === active;
          return (
            <button
              key={theme}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(theme)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isActive
                  ? "bg-foreground text-white shadow-[0_8px_20px_-8px_rgba(26,11,46,0.55)]"
                  : "border border-border bg-surface text-foreground hover:border-primary hover:text-primary hover:-translate-y-0.5",
              )}
            >
              {isActive && <Check className="h-3.5 w-3.5" />}
              {theme}
            </button>
          );
        })}
      </div>

      {/* grid */}
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((b, i) => (
          <motion.div
            key={b.id}
            layout={!reduce}
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: reduce ? 0 : Math.min(i, 5) * 0.05, ease: "easeOut" }}
          >
            <BundleCard bundle={b} />
          </motion.div>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="mt-10 text-center text-muted-foreground">No bundles in this theme yet.</p>
      )}
    </div>
  );
}
