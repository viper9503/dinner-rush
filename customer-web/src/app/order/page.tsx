"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  BellRing,
  Check,
  ChefHat,
  Clock,
  HandPlatter,
  MapPin,
  PackageCheck,
  PartyPopper,
  Phone,
  Receipt,
  ReceiptText,
  Repeat,
  ShoppingBag,
  Sparkles,
  Truck,
  Users,
} from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { cuisineMap } from "@/lib/data";
import { money } from "@/lib/utils";
import { Container, SectionHeading } from "@/components/section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FoodImage } from "@/components/food-image";
import { CoverageMeter } from "@/components/coverage-meter";
import { BundleStack } from "@/components/bundle-stack";

/* ------------------------------------------------------------------ confetti */

const CONFETTI_COLORS = [
  "#ffb020",
  "#e8431f",
  "#d6266e",
  "#6d28c9",
  "#157a4e",
  "#ff7a33",
];

interface Piece {
  id: number;
  x: number;
  y: number;
  rotate: number;
  color: string;
  shape: "rect" | "circle";
  delay: number;
  scale: number;
}

/** Deterministic pseudo-random from an integer seed (no Math.random in render). */
function seeded(n: number) {
  const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/** A celebratory burst. Piece positions are fully deterministic (seeded, no
 *  Math.random/Date), so they're identical on server and client — no hydration
 *  mismatch. The outward animation only starts after mount (rAF) and respects
 *  prefers-reduced-motion. */
function Confetti() {
  const reduce = useReducedMotion();
  const [started, setStarted] = useState(false);

  const pieces = useMemo<Piece[]>(() => {
    const count = 46;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + seeded(i) * 0.5;
      const dist = 120 + seeded(i + 100) * 240;
      return {
        id: i,
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist - 40,
        rotate: seeded(i + 200) * 540 - 270,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        shape: i % 3 === 0 ? "circle" : "rect",
        delay: seeded(i + 300) * 0.18,
        scale: 0.6 + seeded(i + 400) * 0.9,
      };
    });
  }, []);

  useEffect(() => {
    if (reduce) return;
    const raf = requestAnimationFrame(() => setStarted(true));
    return () => cancelAnimationFrame(raf);
  }, [reduce]);

  if (reduce || !started) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-[34%] z-20 h-0 w-0"
    >
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
          animate={{
            x: p.x,
            y: [p.y, p.y + 160],
            scale: p.scale,
            rotate: p.rotate,
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: 1.9,
            delay: p.delay,
            ease: [0.18, 0.7, 0.32, 1],
            times: [0, 0.7, 1],
          }}
          className="absolute"
          style={{
            width: p.shape === "rect" ? 9 : 8,
            height: p.shape === "rect" ? 14 : 8,
            backgroundColor: p.color,
            borderRadius: p.shape === "circle" ? "9999px" : "2px",
          }}
        />
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- tracker */

const STEPS = [
  {
    key: "confirmed",
    title: "Order confirmed",
    sub: "We sent it to all your kitchens",
    Icon: Check,
  },
  {
    key: "preparing",
    title: "Kitchens preparing",
    sub: "Chefs are firing up your trays",
    Icon: ChefHat,
  },
  {
    key: "delivery",
    title: "Out for delivery",
    sub: "One driver, every restaurant",
    Icon: Truck,
  },
  {
    key: "arriving",
    title: "Arriving ~12:30",
    sub: "Set up & ready to serve",
    Icon: MapPin,
  },
] as const;

// The mock "live" position of the order along the timeline.
const ACTIVE_INDEX = 1;

/* --------------------------------------------------------------- main page */

export default function OrderPage() {
  const reduce = useReducedMotion();
  const {
    hydrated,
    grouped,
    itemCount,
    restaurantCount,
    headcount,
    totalServings,
    subtotal,
    deliveryFee,
    serviceFee,
    tax,
    total,
    perPerson,
  } = useCart();

  // Deterministic order number derived from itemCount (no Date.now/random).
  const orderNo = useMemo(() => {
    const base = 4800 + ((itemCount * 17 + restaurantCount * 3) % 199);
    return `#CB-2026-${base}`;
  }, [itemCount, restaurantCount]);

  /* ----- loading skeleton until cart hydrates (avoids mismatch) ----- */
  if (!hydrated) {
    return (
      <section className="bg-radial-warm">
        <Container className="flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
          <div className="grid h-20 w-20 animate-pulse place-items-center rounded-full bg-muted">
            <ShoppingBag className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="mt-5 font-display text-lg font-bold text-foreground">
            Loading your order…
          </p>
        </Container>
      </section>
    );
  }

  /* ----- empty / direct-visit state ----- */
  if (itemCount === 0) {
    return (
      <section className="bg-radial-warm relative overflow-hidden">
        <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-accent/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 top-40 h-72 w-72 rounded-full bg-accent-alt/15 blur-3xl" />
        <Container className="relative flex min-h-[68vh] items-center justify-center py-20">
          <div className="relative w-full max-w-lg overflow-hidden rounded-[1.5rem] border border-border bg-surface p-8 text-center shadow-lift sm:p-10">
            <span className="bg-sunset absolute inset-x-10 -top-px h-1 rounded-full" />
            <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-muted text-5xl">
              🧺
            </div>
            <h1 className="mt-6 font-display text-3xl font-bold tracking-[-0.02em] text-foreground">
              No active order yet
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-[1.0625rem] leading-relaxed text-muted-foreground">
              When you place a bundle, you&apos;ll be able to track every kitchen
              and your delivery right here — start to doorstep.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/restaurants">
                <Button variant="hero" size="lg">
                  Build a bundle <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/bundles">
                <Button variant="outline" size="lg">
                  <Sparkles className="h-4 w-4" /> Browse curated bundles
                </Button>
              </Link>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              Tip: pick a headcount and we size every dish for you.
            </p>
          </div>
        </Container>
      </section>
    );
  }

  const allThumbs = grouped.flatMap((g) => g.lines);

  return (
    <>
      {/* ===================== CELEBRATORY HERO ===================== */}
      <section className="bg-radial-warm relative overflow-hidden">
        <div className="pointer-events-none absolute -left-28 top-8 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 top-32 h-80 w-80 rounded-full bg-accent-alt/20 blur-3xl" />
        <Confetti />

        <Container className="relative py-16 text-center sm:py-20">
          {/* success check */}
          <motion.div
            initial={reduce ? false : { scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 16, delay: 0.05 }}
            className="relative mx-auto grid h-24 w-24 place-items-center rounded-full bg-success text-white shadow-[0_18px_40px_-12px_rgba(21,122,78,0.6)]"
          >
            <span className="absolute inset-0 -z-10 rounded-full bg-success/30 blur-xl" />
            <Check className="h-12 w-12" strokeWidth={3} />
            {!reduce && (
              <motion.span
                initial={{ scale: 0.8, opacity: 0.6 }}
                animate={{ scale: 1.7, opacity: 0 }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
                className="absolute inset-0 rounded-full ring-2 ring-success"
              />
            )}
          </motion.div>

          <motion.div
            initial={reduce ? false : { y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.18, duration: 0.5 }}
          >
            <Badge variant="glass" size="lg" className="mt-7 shadow-sm">
              <PartyPopper className="h-3.5 w-3.5 text-primary" /> Order placed
            </Badge>
            <h1 className="mx-auto mt-5 max-w-3xl font-display text-[clamp(2.25rem,5.5vw,3.75rem)] font-bold leading-[1] tracking-[-0.03em] text-foreground">
              Your bundle is{" "}
              <span className="text-gradient-sunset">on the way!</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
              {restaurantCount} {restaurantCount === 1 ? "kitchen is" : "kitchens are"}{" "}
              already cooking. We&apos;ll bring it all together — one delivery,
              one invoice.
            </p>

            {/* order facts */}
            <div className="mx-auto mt-8 flex max-w-2xl flex-wrap items-stretch justify-center gap-3">
              <Fact
                Icon={Receipt}
                label="Order number"
                value={orderNo}
                tone="ink"
              />
              <Fact
                Icon={Clock}
                label="Estimated delivery"
                value="12:15 – 12:30 PM"
                tone="primary"
              />
              <Fact
                Icon={Users}
                label="Feeding"
                value={`${headcount} guests`}
                tone="grape"
              />
            </div>
          </motion.div>
        </Container>
      </section>

      {/* ===================== DELIVERY TRACKER ===================== */}
      <section className="py-14 sm:py-16">
        <Container>
          <div className="relative overflow-hidden rounded-[1.5rem] border border-border bg-surface p-6 shadow-lift sm:p-9">
            <span className="bg-sunset absolute inset-x-10 -top-px h-1 rounded-full" />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
                  Live tracker
                </p>
                <h2 className="mt-1 font-display text-2xl font-bold tracking-[-0.02em] text-foreground">
                  Right now: kitchens preparing
                </h2>
              </div>
              <Badge variant="sunset" size="lg" className="shadow-sm">
                <span className="relative flex h-2 w-2">
                  {!reduce && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" />
                  )}
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                </span>
                On schedule
              </Badge>
            </div>

            {/* timeline */}
            <ol className="mt-8 flex flex-col gap-0 md:flex-row md:gap-0">
              {STEPS.map((step, i) => {
                const done = i < ACTIVE_INDEX;
                const active = i === ACTIVE_INDEX;
                const reached = done || active;
                const last = i === STEPS.length - 1;
                return (
                  <li
                    key={step.key}
                    className="relative flex flex-1 gap-4 pb-8 md:flex-col md:gap-0 md:pb-0"
                  >
                    {/* connector */}
                    {!last && (
                      <span
                        aria-hidden
                        className={`absolute left-[1.4rem] top-12 h-[calc(100%-3rem)] w-0.5 md:left-auto md:right-0 md:top-[1.4rem] md:h-0.5 md:w-[calc(100%-3rem)] ${
                          done ? "bg-sunset" : "bg-border"
                        }`}
                      />
                    )}

                    <div className="relative z-10 flex items-center gap-4 md:flex-col md:items-start md:gap-0">
                      <motion.span
                        initial={false}
                        animate={
                          active && !reduce
                            ? { scale: [1, 1.08, 1] }
                            : { scale: 1 }
                        }
                        transition={
                          active && !reduce
                            ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
                            : { duration: 0.2 }
                        }
                        className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ring-4 ring-surface ${
                          reached
                            ? "bg-sunset text-white shadow-[0_8px_20px_-6px_rgba(232,67,31,0.5)]"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <step.Icon className="h-5 w-5" strokeWidth={2.4} />
                        {active && !reduce && (
                          <span className="absolute inset-0 rounded-full ring-2 ring-primary/40">
                            <motion.span
                              initial={{ scale: 0.9, opacity: 0.5 }}
                              animate={{ scale: 1.6, opacity: 0 }}
                              transition={{
                                duration: 1.6,
                                repeat: Infinity,
                                ease: "easeOut",
                              }}
                              className="absolute inset-0 rounded-full ring-2 ring-primary/50"
                            />
                          </span>
                        )}
                      </motion.span>
                    </div>

                    <div className="md:mt-4">
                      <div className="flex items-center gap-2">
                        <h3
                          className={`font-display text-base font-bold ${
                            reached ? "text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {step.title}
                        </h3>
                        {done && (
                          <Check className="h-4 w-4 text-success" strokeWidth={3} />
                        )}
                        {active && (
                          <Badge variant="deal" size="sm">
                            Now
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm leading-snug text-muted-foreground">
                        {step.sub}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>

            {/* per-restaurant prep list */}
            <div className="mt-8 border-t border-border pt-6">
              <div className="mb-4 flex items-center gap-2">
                <HandPlatter className="h-4 w-4 text-primary" />
                <h3 className="font-display text-sm font-bold text-foreground">
                  Kitchen status
                </h3>
                <span className="text-xs text-muted-foreground">
                  · {restaurantCount} {restaurantCount === 1 ? "spot" : "spots"} in this run
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {grouped.map((g, i) => {
                  const packed = i === 0;
                  return (
                    <div
                      key={g.restaurant.id}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 p-3"
                    >
                      <span
                        style={{ backgroundColor: g.restaurant.logoColor }}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                      >
                        {g.restaurant.name.charAt(0)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {g.restaurant.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {g.lines.length} {g.lines.length === 1 ? "dish" : "dishes"} · feeds ~
                          {Math.round(g.servings)}
                        </p>
                      </div>
                      {packed ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[0.6875rem] font-semibold text-success ring-1 ring-inset ring-success/25">
                          <PackageCheck className="h-3.5 w-3.5" /> Packed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff2d1] px-2.5 py-1 text-[0.6875rem] font-semibold text-[#8a5a07]">
                          <ChefHat className="h-3.5 w-3.5" /> Preparing
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ===================== BUNDLE SUMMARY ===================== */}
      <section className="bg-radial-warm py-16">
        <Container>
          <SectionHeading
            eyebrow="In this bundle"
            title="Everything you ordered"
            subtitle="Dishes from every kitchen, sized for your headcount and arriving together — billed on one clean invoice."
          />

          <div className="mt-10 grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
            {/* dishes grouped by restaurant */}
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3 rounded-[1.25rem] border border-border bg-surface px-5 py-4 shadow-soft">
                <BundleStack restaurantIds={grouped.map((g) => g.restaurant.id)} />
                <span className="text-sm font-semibold text-muted-foreground">
                  {itemCount} {itemCount === 1 ? "tray" : "trays"}
                </span>
              </div>

              {grouped.map((g) => (
                <div
                  key={g.restaurant.id}
                  className="overflow-hidden rounded-[1.25rem] border border-border bg-surface shadow-soft"
                >
                  <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-5 py-3.5">
                    <span
                      style={{ backgroundColor: g.restaurant.logoColor }}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                    >
                      {g.restaurant.name.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-sm font-bold text-foreground">
                        {g.restaurant.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {g.restaurant.neighborhood}
                      </p>
                    </div>
                    <Badge variant="neutral" size="sm">
                      {cuisineMap[g.restaurant.cuisine].emoji}{" "}
                      {cuisineMap[g.restaurant.cuisine].label}
                    </Badge>
                  </div>

                  <ul className="divide-y divide-border">
                    {g.lines.map(({ dish, qty }) => (
                      <li key={dish.id} className="flex items-center gap-3 px-5 py-3">
                        <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                          <FoodImage
                            src={dish.image}
                            alt={dish.name}
                            emoji={cuisineMap[dish.cuisine].emoji}
                            sizes="56px"
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {dish.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Serves {dish.serves[0]}–{dish.serves[1]}
                          </p>
                        </div>
                        {qty > 1 && (
                          <span className="tnum rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-foreground">
                            ×{qty}
                          </span>
                        )}
                        <span className="tnum w-16 shrink-0 text-right text-sm font-semibold text-foreground">
                          {money(dish.price * qty)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* coverage + totals */}
            <aside className="lg:sticky lg:top-24">
              <div className="relative overflow-hidden rounded-[1.5rem] border border-border bg-surface p-6 shadow-lift">
                <span className="bg-sunset absolute inset-x-8 -top-px h-1 rounded-full" />

                <h3 className="font-display text-lg font-bold text-foreground">
                  Coverage
                </h3>
                <div className="mt-3 rounded-2xl bg-muted p-4">
                  <CoverageMeter servings={totalServings} headcount={headcount} />
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-success">
                    <Check className="h-3.5 w-3.5" /> Sized to feed all {headcount}{" "}
                    guests
                  </p>
                </div>

                {/* thumbs row */}
                <div className="mt-5 flex items-center gap-2">
                  <span className="flex -space-x-3">
                    {allThumbs.slice(0, 5).map(({ dish }) => (
                      <span
                        key={dish.id}
                        className="relative h-10 w-10 overflow-hidden rounded-full ring-2 ring-surface"
                      >
                        <FoodImage
                          src={dish.image}
                          alt={dish.name}
                          emoji={cuisineMap[dish.cuisine].emoji}
                          sizes="40px"
                        />
                      </span>
                    ))}
                  </span>
                  {allThumbs.length > 5 && (
                    <span className="text-xs font-semibold text-muted-foreground">
                      +{allThumbs.length - 5} more
                    </span>
                  )}
                </div>

                <dl className="mt-6 space-y-1.5 border-t border-border pt-5 text-sm">
                  <Row label="Subtotal" value={money(subtotal)} />
                  <Row
                    label="Delivery"
                    value={deliveryFee === 0 ? "FREE" : money(deliveryFee)}
                    accent={deliveryFee === 0}
                  />
                  <Row label="Service" value={money(serviceFee)} />
                  <Row label="Est. tax" value={money(tax)} />
                  <div className="mt-2 flex items-center justify-between border-t border-border pt-2.5">
                    <span className="font-display text-base font-bold text-foreground">
                      Paid
                    </span>
                    <span className="tnum font-display text-xl font-bold text-foreground">
                      {money(total)}
                    </span>
                  </div>
                  <p className="tnum text-right text-xs text-muted-foreground">
                    ≈ {money(perPerson, true)} / guest
                  </p>
                </dl>

                <div className="mt-5 flex items-start gap-2.5 rounded-2xl bg-muted/70 p-3.5">
                  <ReceiptText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Every kitchen, one invoice. A receipt is on its way to your
                    inbox for finance — no chasing five vendors.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </Container>
      </section>

      {/* ===================== WHAT HAPPENS NEXT ===================== */}
      <section className="py-16">
        <Container>
          <SectionHeading
            align="center"
            eyebrow="What happens next"
            title="Sit back — we've got the rest"
          />
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {[
              {
                Icon: BellRing,
                color: "#c7341a",
                title: "Live updates",
                body: "We'll text you the moment your driver is loaded up and rolling toward you.",
              },
              {
                Icon: Truck,
                color: "#6d28c9",
                title: "One coordinated drop",
                body: "Every kitchen's trays arrive together — labeled, set up, and ready to serve.",
              },
              {
                Icon: Repeat,
                color: "#157a4e",
                title: "Reorder in a tap",
                body: "Loved it? Re-run this exact bundle for next week's lunch in seconds.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-[1.25rem] border border-border bg-surface p-6 shadow-soft transition-all hover:-translate-y-1 hover:shadow-lift"
              >
                <span
                  className="grid h-12 w-12 place-items-center rounded-2xl text-white shadow-sm"
                  style={{ backgroundColor: f.color }}
                >
                  <f.Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-bold text-foreground">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </div>
            ))}
          </div>

          {/* CTA band */}
          <div className="bg-sunset relative mt-14 overflow-hidden rounded-[2rem] px-8 py-12 text-center shadow-lift sm:px-16">
            <div className="pointer-events-none absolute -left-10 -top-10 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-12 -right-6 h-56 w-56 rounded-full bg-secondary/30 blur-3xl" />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="font-display text-3xl font-bold leading-tight tracking-[-0.02em] text-white sm:text-4xl">
                Thanks for feeding the team
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-white/90">
                Track it in real time, grab your receipt, or line up next week&apos;s
                spread while you&apos;re here.
              </p>
              <div className="mt-7 flex flex-col flex-wrap items-center justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-[0.9375rem] font-semibold text-white shadow-soft transition-all hover:-translate-y-0.5 hover:bg-foreground/90 active:scale-[0.98]"
                >
                  <MapPin className="h-4 w-4" /> Track in real time
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-[0.9375rem] font-semibold text-foreground shadow-soft transition-all hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  <ReceiptText className="h-4 w-4" /> View receipt
                </button>
              </div>
              <div className="mt-5">
                <Link href="/restaurants">
                  <Button
                    variant="juicy"
                    size="lg"
                    className="shadow-[0_10px_24px_-8px_rgba(0,0,0,0.35)]"
                  >
                    <Repeat className="h-4 w-4" /> Order again
                  </Button>
                </Link>
              </div>
              <p className="mt-5 flex items-center justify-center gap-2 text-sm text-white/85">
                <Phone className="h-4 w-4" /> Questions? Your concierge is one tap
                away.
              </p>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

/* ----------------------------------------------------------------- bits */

function Fact({
  Icon,
  label,
  value,
  tone,
}: {
  Icon: typeof Receipt;
  label: string;
  value: string;
  tone: "ink" | "primary" | "grape";
}) {
  const ring = {
    ink: "text-foreground bg-muted",
    primary: "text-primary bg-[#fff0eb]",
    grape: "text-secondary bg-[#f1eafc]",
  }[tone];
  return (
    <div className="flex min-w-[10rem] flex-1 items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-left shadow-soft">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${ring}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
        <span className="tnum block truncate font-display text-sm font-bold text-foreground">
          {value}
        </span>
      </span>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={
          accent
            ? "tnum font-bold text-success"
            : "tnum font-medium text-foreground"
        }
      >
        {value}
      </dd>
    </div>
  );
}
