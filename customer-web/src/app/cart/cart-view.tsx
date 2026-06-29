"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Check,
  Minus,
  Plus,
  ReceiptText,
  ShoppingBag,
  Sparkles,
  Truck,
  Users,
  Utensils,
  X,
} from "lucide-react";
import { useCart } from "@/lib/cart-context";
import {
  bundles,
  cuisineMap,
  dishes,
  popularDishes,
  restaurantMap,
} from "@/lib/data";
import type { Dish } from "@/lib/types";
import { money } from "@/lib/utils";
import { Container, SectionHeading } from "@/components/section";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FoodImage } from "@/components/food-image";
import { DietaryBadges } from "@/components/dietary";
import { DishCard } from "@/components/dish-card";
import { BundleCard } from "@/components/bundle-card";
import { CoverageMeter } from "@/components/coverage-meter";
import { HeadcountStepper } from "@/components/headcount-stepper";
import { cn } from "@/lib/utils";

/* ───────────────────────── page ───────────────────────── */

export function CartView() {
  const cart = useCart();
  const { hydrated, itemCount } = cart;

  if (!hydrated) return <CartSkeleton />;
  if (itemCount === 0) return <EmptyBundle />;

  return <FilledBundle />;
}

/* ─────────────────────── filled state ─────────────────────── */

function FilledBundle() {
  const cart = useCart();
  const {
    grouped,
    itemCount,
    restaurantCount,
    headcount,
    totalServings,
    covered,
    restaurantIds,
    subtotal,
    deliveryFee,
    serviceFee,
    tax,
    total,
    perPerson,
  } = cart;

  const missing = Math.max(0, Math.ceil(headcount - totalServings));

  // suggestions: popular dishes from restaurants NOT already in the bundle,
  // de-duplicated by restaurant so we always push multi-restaurant mixing.
  const suggestions = useMemo(() => {
    const inCart = new Set(restaurantIds);
    const seenRest = new Set<string>();
    const pool: Dish[] = [...popularDishes, ...dishes];
    const picks: Dish[] = [];
    for (const d of pool) {
      if (inCart.has(d.restaurantId) || seenRest.has(d.restaurantId)) continue;
      seenRest.add(d.restaurantId);
      picks.push(d);
      if (picks.length === 3) break;
    }
    return picks;
  }, [restaurantIds]);

  return (
    <div className="bg-radial-warm">
      <Container className="py-10 sm:py-14">
        {/* header */}
        <header className="mb-8">
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge variant="glass" size="lg" className="shadow-sm">
              <ShoppingBag className="h-3.5 w-3.5 text-primary" /> The bundle builder
            </Badge>
            <Badge variant="multi" size="md">
              {restaurantCount} {restaurantCount === 1 ? "restaurant" : "restaurants"}
            </Badge>
          </div>
          <h1 className="mt-4 font-display text-[clamp(2.25rem,5vw,3.25rem)] font-bold leading-[1] tracking-[-0.02em] text-foreground">
            Your bundle
          </h1>
          <p className="mt-3 text-[1.0625rem] text-muted-foreground">
            <span className="font-semibold text-foreground">{itemCount}</span>{" "}
            {itemCount === 1 ? "item" : "items"} from{" "}
            <span className="font-semibold text-foreground">{restaurantCount}</span>{" "}
            {restaurantCount === 1 ? "restaurant" : "restaurants"} — one delivery, one
            invoice.
          </p>
        </header>

        {/* two columns */}
        <div className="grid items-start gap-8 lg:grid-cols-[1.65fr_1fr]">
          {/* ───────── LEFT ───────── */}
          <div className="space-y-8">
            {/* coverage panel */}
            <section className="relative overflow-hidden rounded-[1.25rem] border border-border bg-surface p-5 shadow-soft sm:p-6">
              <span className="bg-sunset absolute inset-x-6 -top-px h-1 rounded-full" />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold text-foreground">
                    Coverage check
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Feeding{" "}
                    <span className="tnum font-semibold text-foreground">{headcount}</span>{" "}
                    guests
                  </p>
                </div>
                <HeadcountStepper />
              </div>

              <div className="mt-5">
                <CoverageMeter servings={totalServings} headcount={headcount} />
              </div>

              <CoverageMessage covered={covered} missing={missing} />
            </section>

            {/* grouped lines */}
            <section className="space-y-7">
              <AnimatePresence initial={false} mode="popLayout">
                {grouped.map((g) => (
                  <motion.div
                    key={g.restaurant.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 280, damping: 30 }}
                    className="overflow-hidden rounded-[1.25rem] border border-border bg-surface shadow-soft"
                  >
                    {/* restaurant header */}
                    <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/40 px-4 py-3.5 sm:px-5">
                      <span
                        style={{ backgroundColor: g.restaurant.logoColor }}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-sm font-bold text-white shadow-sm"
                      >
                        {g.restaurant.name.charAt(0)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-display text-base font-bold leading-tight text-foreground">
                          {g.restaurant.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {g.restaurant.neighborhood}
                        </p>
                      </div>
                      <Badge variant="neutral" size="md" className="ml-1">
                        {cuisineMap[g.restaurant.cuisine].emoji}{" "}
                        {cuisineMap[g.restaurant.cuisine].label}
                      </Badge>
                      <Link
                        href={`/restaurants/${g.restaurant.slug}`}
                        className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold text-primary transition hover:bg-primary/10"
                      >
                        View menu <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>

                    {/* lines */}
                    <ul className="divide-y divide-border">
                      <AnimatePresence initial={false} mode="popLayout">
                        {g.lines.map(({ dish, qty }) => (
                          <CartLine key={dish.id} dish={dish} qty={qty} />
                        ))}
                      </AnimatePresence>
                    </ul>

                    {/* group footer */}
                    <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-4 py-3 text-sm sm:px-5">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        Feeds ~{Math.round(g.servings)}
                      </span>
                      <span className="tnum font-semibold text-foreground">
                        {money(g.subtotal)}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </section>

            {/* keep adding / browse */}
            <Link
              href="/restaurants"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "w-full",
              )}
            >
              <Plus className="h-4 w-4" /> Add another restaurant
            </Link>

            {/* suggestions */}
            {suggestions.length > 0 && (
              <section className="pt-2">
                <SectionHeading
                  eyebrow="Mix it up"
                  title="Complete your bundle"
                  subtitle="Crowd-pleasers from restaurants you haven't added yet — variety keeps everyone happy."
                />
                <div className="mt-7 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {suggestions.map((d) => (
                    <DishCard key={d.id} dish={d} showRestaurant />
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ───────── RIGHT (sticky summary) ───────── */}
          <aside className="lg:sticky lg:top-24">
            <div className="relative overflow-hidden rounded-[1.25rem] border border-border bg-surface p-6 shadow-lift">
              <span className="bg-sunset absolute inset-x-8 -top-px h-1 rounded-full" />
              <h2 className="font-display text-xl font-bold text-foreground">
                Order summary
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {itemCount} {itemCount === 1 ? "item" : "items"} ·{" "}
                {restaurantCount} {restaurantCount === 1 ? "kitchen" : "kitchens"}
              </p>

              <dl className="mt-5 space-y-2.5 text-sm">
                <SummaryRow label="Subtotal" value={money(subtotal)} />
                <div>
                  <SummaryRow
                    label="Delivery"
                    value={deliveryFee === 0 ? "FREE" : money(deliveryFee)}
                    free={deliveryFee === 0}
                  />
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Free delivery over {money(250)}
                  </p>
                </div>
                <SummaryRow label="Service fee" value={money(serviceFee)} />
                <SummaryRow label="Est. tax" value={money(tax)} />
              </dl>

              <div className="mt-4 border-t border-border pt-4">
                <div className="flex items-end justify-between">
                  <span className="font-display text-lg font-bold text-foreground">
                    Total
                  </span>
                  <span className="tnum font-display text-3xl font-bold text-foreground">
                    {money(total)}
                  </span>
                </div>
                <p className="tnum mt-1 text-right text-sm text-muted-foreground">
                  ≈ {money(perPerson, true)} / guest
                </p>
              </div>

              <Link href="/checkout" className="mt-5 block">
                <Button variant="hero" size="lg" className="w-full">
                  Proceed to checkout <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>

              <ul className="mt-5 space-y-2.5 text-xs text-muted-foreground">
                <TrustLine Icon={Truck}>
                  One coordinated delivery from every kitchen
                </TrustLine>
                <TrustLine Icon={ReceiptText}>One simple invoice for finance</TrustLine>
                <TrustLine Icon={Check}>Labeled, set up and on time</TrustLine>
              </ul>
            </div>

            {/* coverage mini-recap */}
            <div
              className={cn(
                "mt-4 flex items-start gap-3 rounded-[1.25rem] border p-4 text-sm",
                covered
                  ? "border-success/25 bg-success/5"
                  : "border-border bg-muted/50",
              )}
            >
              <span
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-full text-white",
                  covered ? "bg-success" : "bg-primary",
                )}
              >
                {covered ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Users className="h-4 w-4" />
                )}
              </span>
              <p className="leading-relaxed text-foreground">
                {covered ? (
                  <>Everyone&apos;s covered — feeds ~{Math.round(totalServings)} of {headcount}.</>
                ) : (
                  <>
                    Currently feeds ~{Math.round(totalServings)} of {headcount}. Add about{" "}
                    <span className="font-semibold text-primary">{missing}</span> more
                    servings.
                  </>
                )}
              </p>
            </div>
          </aside>
        </div>
      </Container>
    </div>
  );
}

/* ─────────────────────── one cart line ─────────────────────── */

function CartLine({ dish, qty }: { dish: Dish; qty: number }) {
  const { increment, decrement, remove } = useCart();
  const reduce = useReducedMotion();
  const c = cuisineMap[dish.cuisine];

  return (
    <motion.li
      layout
      initial={reduce ? false : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 34 }}
      className="overflow-hidden"
    >
      <div className="flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5">
        <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-1 ring-border">
          <FoodImage src={dish.image} alt={dish.name} emoji={c.emoji} sizes="64px" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[0.9375rem] font-bold leading-tight text-foreground">
            {dish.name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> Serves {dish.serves[0]}–{dish.serves[1]}
            </span>
            <span aria-hidden>·</span>
            <span className="tnum font-semibold text-primary">{money(dish.price)}</span>
          </div>
          {dish.dietary.length > 0 && (
            <DietaryBadges tags={dish.dietary} max={2} className="mt-2" />
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex items-center gap-1 rounded-full bg-muted p-1">
            <button
              type="button"
              aria-label={`Remove one ${dish.name}`}
              onClick={() => decrement(dish.id)}
              className="grid h-8 w-8 place-items-center rounded-full bg-white text-foreground shadow-sm transition hover:border-primary hover:text-primary"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="tnum w-6 text-center text-sm font-bold text-foreground">
              {qty}
            </span>
            <button
              type="button"
              aria-label={`Add one ${dish.name}`}
              onClick={() => increment(dish.id)}
              className="grid h-8 w-8 place-items-center rounded-full bg-primary text-white shadow-sm transition hover:bg-primary-bright"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="tnum text-sm font-bold text-foreground">
              {money(dish.price * qty)}
            </span>
            <button
              type="button"
              aria-label={`Remove ${dish.name} from bundle`}
              onClick={() => remove(dish.id)}
              className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition hover:bg-accent-alt/10 hover:text-accent-alt"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.li>
  );
}

/* ─────────────────────── coverage message ─────────────────────── */

function CoverageMessage({ covered, missing }: { covered: boolean; missing: number }) {
  if (covered) {
    return (
      <div className="mt-4 flex items-center gap-2.5 rounded-2xl bg-success/10 px-4 py-3 text-sm font-semibold text-success">
        <Check className="h-4 w-4 shrink-0" />
        Everyone&apos;s covered 🎉
      </div>
    );
  }
  return (
    <div className="mt-4 flex items-center gap-2.5 rounded-2xl bg-muted px-4 py-3 text-sm font-semibold text-foreground">
      <Utensils className="h-4 w-4 shrink-0 text-primary" />
      Add about{" "}
      <span className="tnum text-primary">{missing}</span> more servings to cover
      everyone.
    </div>
  );
}

/* ─────────────────────── small bits ─────────────────────── */

function SummaryRow({
  label,
  value,
  free,
}: {
  label: string;
  value: string;
  free?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "tnum font-semibold",
          free ? "text-success" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function TrustLine({
  Icon,
  children,
}: {
  Icon: typeof Truck;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-2">
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-muted text-primary">
        <Icon className="h-3 w-3" />
      </span>
      {children}
    </li>
  );
}

/* ─────────────────────── empty state ─────────────────────── */

function EmptyBundle() {
  const suggested = useMemo(() => bundles.filter((b) => b.popular).slice(0, 3), []);
  const fallback = useMemo(() => bundles.slice(0, 3), []);
  const picks = suggested.length >= 3 ? suggested : fallback;

  return (
    <div className="bg-radial-warm">
      <Container className="py-16 sm:py-24">
        <div className="mx-auto max-w-xl text-center">
          <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-muted text-5xl shadow-soft">
            🧺
          </div>
          <h1 className="mt-7 font-display text-[clamp(2rem,5vw,3rem)] font-bold leading-[1.05] tracking-[-0.02em] text-foreground">
            Your bundle is empty
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[1.0625rem] leading-relaxed text-muted-foreground">
            Mix dishes from as many local kitchens as you like — tacos here, ramen there,
            a salad bar to balance. One delivery, one invoice.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/restaurants">
              <Button variant="hero" size="lg">
                Browse restaurants <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/bundles">
              <Button variant="outline" size="lg">
                <Sparkles className="h-4 w-4" /> See curated bundles
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-16">
          <SectionHeading
            align="center"
            eyebrow="Done-for-you"
            title="Start from a crowd-pleaser"
            subtitle="These multi-restaurant bundles are pre-balanced and priced per person — add one and tweak from there."
          />
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {picks.map((b) => (
              <BundleCard key={b.id} bundle={b} />
            ))}
          </div>
        </div>
      </Container>
    </div>
  );
}

/* ─────────────────────── skeleton (pre-hydration) ─────────────────────── */

function CartSkeleton() {
  return (
    <div className="bg-radial-warm">
      <Container className="py-10 sm:py-14">
        <div className="mb-8">
          <div className="h-7 w-40 rounded-full bg-muted" />
          <div className="mt-4 h-10 w-64 rounded-2xl bg-muted" />
          <div className="mt-3 h-5 w-80 max-w-full rounded-full bg-muted" />
        </div>
        <div className="grid items-start gap-8 lg:grid-cols-[1.65fr_1fr]">
          <div className="space-y-8">
            <div className="h-40 rounded-[1.25rem] border border-border bg-surface shadow-soft" />
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-56 rounded-[1.25rem] border border-border bg-surface shadow-soft"
              />
            ))}
          </div>
          <div className="h-96 rounded-[1.25rem] border border-border bg-surface shadow-lift lg:sticky lg:top-24" />
        </div>
      </Container>
    </div>
  );
}
