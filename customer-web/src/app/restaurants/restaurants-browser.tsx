"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Search, SlidersHorizontal, X, ArrowRight } from "lucide-react";
import Link from "next/link";
import {
  restaurants,
  cuisines,
  cuisineMap,
  popularDishes,
  dishesByRestaurant,
} from "@/lib/data";
import type { DietaryTag } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Container, SectionHeading } from "@/components/section";
import { Button } from "@/components/ui/button";
import { RestaurantCard } from "@/components/restaurant-card";
import { DishCard } from "@/components/dish-card";

type SortKey = "recommended" | "rating" | "prep" | "min";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recommended", label: "Recommended" },
  { key: "rating", label: "Top rated" },
  { key: "prep", label: "Fastest prep" },
  { key: "min", label: "Lowest minimum" },
];

// Lower = sooner. Used to rank by "Fastest prep".
const PREP_RANK: Record<string, number> = {
  "Same day": 0,
  "24h notice": 1,
  "48h notice": 2,
};

const DIET_CHIPS: { key: DietaryTag; label: string; emoji: string }[] = [
  { key: "vegetarian", label: "Vegetarian", emoji: "🥬" },
  { key: "vegan", label: "Vegan", emoji: "🌱" },
  { key: "gluten-free", label: "Gluten-free", emoji: "🌾" },
  { key: "spicy", label: "Spicy", emoji: "🌶️" },
];

export function RestaurantsBrowser({
  initialCuisine,
}: {
  initialCuisine: string;
}) {
  const reduce = useReducedMotion();
  const [query, setQuery] = useState("");
  const [cuisine, setCuisine] = useState(initialCuisine);
  const [sort, setSort] = useState<SortKey>("recommended");
  const [diets, setDiets] = useState<DietaryTag[]>([]);

  const hasFilters =
    query.trim() !== "" || cuisine !== "all" || diets.length > 0;

  const toggleDiet = (d: DietaryTag) =>
    setDiets((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );

  const reset = () => {
    setQuery("");
    setCuisine("all");
    setDiets([]);
    setSort("recommended");
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtered = restaurants.filter((r) => {
      if (cuisine !== "all" && r.cuisine !== cuisine) return false;

      if (q) {
        const label = cuisineMap[r.cuisine]?.label ?? "";
        const hay = `${r.name} ${r.tagline} ${label} ${r.neighborhood}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (diets.length > 0) {
        const menu = dishesByRestaurant(r.id);
        // restaurant qualifies if it offers at least one dish for every chosen diet
        const ok = diets.every((d) => menu.some((dish) => dish.dietary.includes(d)));
        if (!ok) return false;
      }

      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (sort) {
        case "rating":
          return b.rating - a.rating || b.reviews - a.reviews;
        case "prep":
          return (
            (PREP_RANK[a.prepTime] ?? 9) - (PREP_RANK[b.prepTime] ?? 9) ||
            b.rating - a.rating
          );
        case "min":
          return a.minOrder - b.minOrder || b.rating - a.rating;
        default:
          // recommended: featured first, then rating
          return (
            Number(b.featured ?? false) - Number(a.featured ?? false) ||
            b.rating - a.rating
          );
      }
    });

    return sorted;
  }, [query, cuisine, sort, diets]);

  const count = results.length;

  return (
    <>
      {/* sticky filter rail */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <Container className="py-4">
          {/* search + sort row */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="group flex flex-1 items-center gap-3 rounded-full bg-white p-2 pl-5 shadow-[0_12px_30px_-12px_rgba(232,67,31,0.22)] ring-1 ring-border transition focus-within:ring-2 focus-within:ring-primary">
              <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tacos, ramen, BBQ, a neighborhood…"
                aria-label="Search restaurants"
                className="min-w-0 flex-1 bg-transparent py-1.5 text-[0.9375rem] text-foreground outline-none placeholder:text-muted-foreground"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>

            {/* sort control */}
            <div className="flex shrink-0 items-center gap-2 rounded-full bg-muted p-1">
              <span className="hidden pl-3 pr-1 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground sm:flex sm:items-center sm:gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" /> Sort
              </span>
              <div className="flex items-center gap-1 overflow-x-auto">
                {SORTS.map((s) => {
                  const active = sort === s.key;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSort(s.key)}
                      className={cn(
                        "rounded-full px-3.5 py-2 text-[0.8125rem] font-semibold whitespace-nowrap transition",
                        active
                          ? "bg-white text-foreground shadow-sm ring-1 ring-border"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* cuisine chip row */}
          <div className="-mx-5 mt-3 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8">
            <div className="flex w-max items-center gap-2">
              <CuisineChip
                active={cuisine === "all"}
                emoji="🍽️"
                label="All"
                onClick={() => setCuisine("all")}
              />
              {cuisines.map((c) => (
                <CuisineChip
                  key={c.key}
                  active={cuisine === c.key}
                  emoji={c.emoji}
                  label={c.label}
                  color={c.color}
                  onClick={() => setCuisine(cuisine === c.key ? "all" : c.key)}
                />
              ))}
            </div>
          </div>

          {/* dietary chip row */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
              Must offer
            </span>
            {DIET_CHIPS.map((d) => {
              const active = diets.includes(d.key);
              return (
                <button
                  key={d.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleDiet(d.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    active
                      ? "border-success bg-success text-white shadow-sm"
                      : "border-border bg-white text-foreground hover:border-success hover:text-success",
                  )}
                >
                  <span className="text-sm leading-none">{d.emoji}</span>
                  {d.label}
                </button>
              );
            })}
            {hasFilters && (
              <button
                type="button"
                onClick={reset}
                className="ml-1 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" /> Clear all
              </button>
            )}
          </div>
        </Container>
      </div>

      {/* results */}
      <section className="py-12 sm:py-14">
        <Container>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Showing{" "}
              <span className="tnum font-bold text-foreground">{count}</span>{" "}
              {count === 1 ? "restaurant" : "restaurants"}
              {cuisine !== "all" && cuisineMap[cuisine] && (
                <>
                  {" "}
                  in{" "}
                  <span className="font-bold text-foreground">
                    {cuisineMap[cuisine].emoji} {cuisineMap[cuisine].label}
                  </span>
                </>
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              All bundled into{" "}
              <span className="font-bold text-foreground">one delivery</span>.
            </p>
          </div>

          {count === 0 ? (
            <EmptyState onReset={reset} />
          ) : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((r) => (
                <motion.div key={r.id} layout={!reduce} transition={{ duration: 0.3, ease: "easeOut" }}>
                  <RestaurantCard restaurant={r} />
                </motion.div>
              ))}
            </div>
          )}
        </Container>
      </section>

      {/* popular dishes to mix in */}
      <section className="bg-radial-warm py-16 sm:py-20">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              eyebrow="Mix & match"
              title={
                <>
                  Popular dishes to drop into{" "}
                  <span className="text-gradient-sunset">any bundle</span>
                </>
              }
              subtitle="Don't pick just one restaurant. Pull a crowd-favorite from each kitchen — they all arrive together, sized for your headcount."
            />
            <Link href="/bundles" className="hidden shrink-0 sm:block">
              <Button variant="outline">
                See curated bundles <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {popularDishes.map((d) => (
              <div key={d.id} className="group">
                <DishCard dish={d} showRestaurant />
              </div>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}

function CuisineChip({
  active,
  emoji,
  label,
  color,
  onClick,
}: {
  active: boolean;
  emoji: string;
  label: string;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={active && color ? { backgroundColor: color, borderColor: color } : undefined}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition",
        active
          ? "border-primary bg-primary text-white shadow-sm"
          : "border-border bg-white text-foreground hover:-translate-y-0.5 hover:border-[#ffd9a8]",
      )}
    >
      <span className="text-base leading-none">{emoji}</span>
      {label}
    </button>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="mt-10 flex flex-col items-center justify-center rounded-[1.25rem] border border-border bg-surface px-6 py-16 text-center shadow-soft">
      <span className="grid h-20 w-20 place-items-center rounded-full bg-muted text-5xl">
        🍽️
      </span>
      <h3 className="mt-5 font-display text-2xl font-bold text-foreground">
        No matches — yet
      </h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        No kitchens fit that combination. Try a different cuisine, loosen the
        dietary filters, or clear your search to see every restaurant.
      </p>
      <Button variant="primary" className="mt-6" onClick={onReset}>
        Reset filters
      </Button>
    </div>
  );
}
