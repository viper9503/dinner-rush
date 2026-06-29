"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Minus, Plus, ShoppingBag, Users } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { cuisineMap, dishMap, packageMap, packageRestaurants, restaurantMap } from "@/lib/data";
import { cn, money, servesAvg } from "@/lib/utils";
import { Container } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FoodImage } from "@/components/food-image";
import { BundleStack } from "@/components/bundle-stack";

export function PackageConfigurator({ slug }: { slug: string }) {
  const router = useRouter();
  const cart = useCart();
  const pkg = packageMap[slug];

  const [guests, setGuests] = useState(Math.max(pkg.minGuests, 20));
  const [sel, setSel] = useState<string[][]>(pkg.sections.map(() => []));

  const setGuestCount = (n: number) => setGuests(Math.max(pkg.minGuests, Math.min(500, n)));

  const toggle = (si: number, dishId: string) => {
    setSel((prev) =>
      prev.map((cur, i) => {
        if (i !== si) return cur;
        const max = pkg.sections[si].maxSelections;
        const has = cur.includes(dishId);
        if (max === 1) return has ? [] : [dishId];
        if (has) return cur.filter((d) => d !== dishId);
        if (cur.length < max) return [...cur, dishId];
        return cur; // at max — ignore
      }),
    );
  };

  const qtyFor = (dishId: string) => {
    const dish = dishMap[dishId];
    return Math.max(1, Math.ceil(guests / servesAvg(dish.serves)));
  };

  const chosen = useMemo(() => sel.flat(), [sel]);
  const estTotal = useMemo(
    () => chosen.reduce((s, id) => s + dishMap[id].price * qtyFor(id), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chosen, guests],
  );
  const valid = sel.every((s) => s.length >= 1);
  const restaurants = packageRestaurants(pkg);
  const cuisine = cuisineMap[pkg.cuisine];

  const addToBundle = () => {
    cart.setHeadcount(guests);
    for (const id of chosen) cart.add(id, qtyFor(id));
    router.push("/cart");
  };

  return (
    <>
      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="relative h-60 sm:h-72">
          <FoodImage src={pkg.image} alt={pkg.name} emoji={cuisine.emoji} sizes="100vw" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/25 to-transparent" />
        </div>
        <Container className="relative -mt-24 pb-2">
          <Link href="/packages" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-white/90 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> All packages
          </Link>
          <div className="rounded-[1.5rem] border border-border bg-surface p-6 shadow-lift sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Badge variant="neutral" size="sm" className="mb-2">{cuisine.emoji} {pkg.theme}</Badge>
                <h1 className="font-display text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl">{pkg.name}</h1>
                <p className="mt-2 max-w-xl text-muted-foreground">{pkg.description}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <BundleStack restaurantIds={restaurants.map((r) => r.id)} />
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> {pkg.minGuests}+ guests
                </span>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-radial-warm py-10">
        <Container className="grid gap-8 lg:grid-cols-[1.6fr_1fr] lg:items-start">
          {/* left: configurator */}
          <div className="space-y-6">
            {/* guests */}
            <div className="rounded-[1.25rem] border border-border bg-surface p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-bold text-foreground">How many guests?</h2>
                  <p className="text-sm text-muted-foreground">We size each dish to cover your headcount.</p>
                </div>
                <div className="flex items-center gap-3 rounded-full border border-border bg-white px-2 py-1.5">
                  <button type="button" onClick={() => setGuestCount(guests - 5)} className="grid h-8 w-8 place-items-center rounded-full text-foreground hover:bg-muted">
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="tnum w-10 text-center font-display text-lg font-bold text-foreground">{guests}</span>
                  <button type="button" onClick={() => setGuestCount(guests + 5)} className="grid h-8 w-8 place-items-center rounded-full text-foreground hover:bg-muted">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* sections */}
            {pkg.sections.map((section, si) => (
              <div key={section.name} className="rounded-[1.25rem] border border-border bg-surface p-5 shadow-soft">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-display text-lg font-bold text-foreground">{section.name}</h3>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {sel[si].length}/{section.maxSelections} · pick {section.maxSelections === 1 ? "one" : `up to ${section.maxSelections}`}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {section.options.map((opt) => {
                    const dish = dishMap[opt.dishId];
                    const restaurant = restaurantMap[dish.restaurantId];
                    const active = sel[si].includes(opt.dishId);
                    return (
                      <button
                        key={opt.dishId}
                        type="button"
                        onClick={() => toggle(si, opt.dishId)}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl border bg-white p-3 text-left transition",
                          active ? "border-primary ring-2 ring-primary/15" : "border-border hover:border-primary/40",
                        )}
                      >
                        <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                          <FoodImage src={dish.image} alt={dish.name} emoji={cuisineMap[dish.cuisine].emoji} sizes="56px" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-foreground">{opt.label ?? dish.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{restaurant?.name} · serves {dish.serves[0]}–{dish.serves[1]}</span>
                        </span>
                        <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition", active ? "border-primary bg-primary text-white" : "border-border")}>
                          {active && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* right: summary */}
          <aside className="lg:sticky lg:top-24">
            <div className="rounded-[1.5rem] border border-border bg-surface p-6 shadow-lift">
              <span className="bg-sunset mb-4 block h-1 w-12 rounded-full" />
              <h3 className="font-display text-xl font-bold text-foreground">Your package</h3>
              <p className="mt-1 text-sm text-muted-foreground">Feeding {guests} guests</p>

              {chosen.length === 0 ? (
                <p className="mt-6 rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
                  Choose an option in each section to build your spread.
                </p>
              ) : (
                <ul className="mt-5 space-y-3">
                  {chosen.map((id) => {
                    const dish = dishMap[id];
                    const qty = qtyFor(id);
                    return (
                      <li key={id} className="flex items-center gap-3">
                        <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                          <FoodImage src={dish.image} alt={dish.name} emoji={cuisineMap[dish.cuisine].emoji} sizes="40px" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-foreground">{dish.name}</span>
                          <span className="block text-xs text-muted-foreground">×{qty} tray{qty > 1 ? "s" : ""}</span>
                        </span>
                        <span className="tnum text-sm font-semibold text-foreground">{money(dish.price * qty)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                <span className="font-display text-base font-bold text-foreground">Estimated</span>
                <span className="text-right">
                  <span className="tnum block font-display text-2xl font-bold text-foreground">{money(estTotal)}</span>
                  {guests > 0 && chosen.length > 0 && (
                    <span className="tnum block text-xs text-muted-foreground">{money(estTotal / guests, true)} / guest</span>
                  )}
                </span>
              </div>

              <Button variant="hero" size="lg" className="mt-5 w-full" disabled={!valid} onClick={addToBundle}>
                <ShoppingBag className="h-5 w-5" /> Add to bundle <ArrowRight className="h-5 w-5" />
              </Button>
              {!valid && (
                <p className="mt-2 text-center text-xs text-muted-foreground">Pick at least one option in every section.</p>
              )}
            </div>
          </aside>
        </Container>
      </section>
    </>
  );
}
