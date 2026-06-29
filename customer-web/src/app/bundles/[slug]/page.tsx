import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowRight,
  Users,
  Truck,
  ReceiptText,
  Sparkles,
  Check,
  UtensilsCrossed,
  CalendarClock,
} from "lucide-react";
import { bundles, bundleRestaurants, dishMap } from "@/lib/data";
import type { Dish } from "@/lib/types";
import { money, servesAvg } from "@/lib/utils";
import { Container, SectionHeading, ScallopDivider } from "@/components/section";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FoodImage } from "@/components/food-image";
import { BundleCard } from "@/components/bundle-card";
import { BundleStack } from "@/components/bundle-stack";
import { CoverageMeter } from "@/components/coverage-meter";
import { DietaryBadges } from "@/components/dietary";
import { AddToBundle, AddBundleButton } from "@/components/add-to-bundle";

export function generateStaticParams() {
  return bundles.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const bundle = bundles.find((b) => b.slug === slug);
  if (!bundle) return { title: "Bundle not found · Dinner Rush" };
  return {
    title: `${bundle.name} · Dinner Rush`,
    description: bundle.description,
  };
}

const VALUE_PROPS = [
  {
    Icon: Users,
    title: "Sized for your headcount",
    body: "Every tray is portioned for groups, and our live coverage meter makes sure all your guests are fed — without over-ordering.",
    color: "#c7341a",
  },
  {
    Icon: Sparkles,
    title: "Several kitchens, one cart",
    body: "We hand-picked dishes from multiple local restaurants so the whole room gets something they love — no compromise.",
    color: "#6d28c9",
  },
  {
    Icon: Truck,
    title: "One delivery, one invoice",
    body: "Everything arrives together, labeled and set up — and finance gets a single clean bill instead of five.",
    color: "#157a4e",
  },
] as const;

export default async function BundleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const bundle = bundles.find((b) => b.slug === slug);
  if (!bundle) notFound();

  const rests = bundleRestaurants(bundle);
  const includedDishes = bundle.dishIds
    .map((id) => dishMap[id])
    .filter((d): d is Dish => Boolean(d));

  // total servings this spread provides vs. the headcount it's priced for
  const bundleServings = includedDishes.reduce((sum, d) => sum + servesAvg(d.serves), 0);
  const total = bundle.pricePerPerson * bundle.serves;

  // a la carte sum (what the dishes would cost individually) — for the savings cue
  const aLaCarte = includedDishes.reduce((sum, d) => sum + d.price, 0);
  const savings = Math.max(0, aLaCarte - total);

  // group the included dishes by restaurant, preserving the bundleRestaurants order
  const groups = rests
    .map((r) => ({
      restaurant: r,
      dishes: includedDishes.filter((d) => d.restaurantId === r.id),
    }))
    .filter((g) => g.dishes.length > 0);

  // a few other bundles to surface at the bottom
  const moreBundles = bundles.filter((b) => b.id !== bundle.id);

  return (
    <>
      {/* ============================== HERO ============================== */}
      <section className="bg-radial-warm relative overflow-hidden">
        <div className="pointer-events-none absolute -left-32 top-12 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 top-44 h-80 w-80 rounded-full bg-accent-alt/20 blur-3xl" />

        <Container className="relative py-10 lg:py-14">
          {/* breadcrumb */}
          <nav className="mb-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="transition-colors hover:text-primary">
              Home
            </Link>
            <span aria-hidden>/</span>
            <Link href="/bundles" className="transition-colors hover:text-primary">
              Bundles
            </Link>
            <span aria-hidden>/</span>
            <span className="font-semibold text-foreground">{bundle.name}</span>
          </nav>

          <div className="grid items-center gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14">
            {/* hero image */}
            <div className="relative">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[1.25rem] shadow-lift ring-1 ring-border">
                <FoodImage
                  src={bundle.image}
                  alt={bundle.name}
                  emoji="🧺"
                  sizes="(max-width:1024px) 100vw, 50vw"
                  priority
                />
                <div className="scrim absolute inset-0" />
                <Badge variant="multi" size="lg" className="absolute left-4 top-4 shadow-sm">
                  🧺 Curated bundle
                </Badge>
                {bundle.popular && (
                  <Badge variant="sunset" size="lg" className="absolute right-4 top-4 shadow-sm">
                    ⭐ Most Popular
                  </Badge>
                )}
                {/* floating coverage chip */}
                <div className="glass absolute inset-x-4 bottom-4 rounded-[1.25rem] p-4">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-display text-sm font-bold text-foreground">
                      Covers {bundle.serves} guests
                    </span>
                    <span className="flex items-center gap-1 text-xs font-semibold text-success">
                      <Check className="h-3.5 w-3.5" /> Balanced
                    </span>
                  </div>
                  <CoverageMeter
                    servings={bundleServings}
                    headcount={bundle.serves}
                    size="sm"
                    showHeader={false}
                  />
                </div>
              </div>

              {/* small savings tag */}
              {savings > 0 && (
                <div className="absolute -right-3 -top-4 hidden rotate-3 sm:block">
                  <span className="bg-sunset grid place-items-center rounded-full px-4 py-3 text-center font-display text-sm font-bold leading-tight text-white shadow-lift">
                    Save
                    <br />
                    {money(savings)}
                  </span>
                </div>
              )}
            </div>

            {/* hero details */}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="serves" size="lg">
                  {bundle.theme}
                </Badge>
                <Badge variant="glass" size="lg" className="shadow-sm">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> {bundle.tagline}
                </Badge>
              </div>

              <h1 className="mt-4 font-display text-[clamp(2.25rem,4.5vw,3.25rem)] font-bold leading-[1.02] tracking-[-0.02em] text-foreground">
                {bundle.name}
              </h1>

              <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
                {bundle.description}
              </p>

              {/* restaurant stack */}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <BundleStack restaurantIds={rests.map((r) => r.id)} />
                <span className="text-sm text-muted-foreground">
                  Dishes from{" "}
                  <span className="font-semibold text-foreground">
                    {rests.map((r) => r.name).join(", ")}
                  </span>
                </span>
              </div>

              {/* serves + price row */}
              <div className="mt-7 flex flex-wrap items-end gap-x-8 gap-y-4 rounded-[1.25rem] border border-border bg-surface p-5 shadow-soft">
                <div>
                  <div className="tnum font-display text-4xl font-bold text-foreground">
                    {money(bundle.pricePerPerson)}
                    <span className="text-base font-medium text-muted-foreground">/person</span>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" /> Serves {bundle.serves} guests
                  </p>
                </div>
                <div className="h-12 w-px bg-border" aria-hidden />
                <div>
                  <div className="tnum font-display text-2xl font-bold text-primary">
                    {money(total)}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">estimated bundle total</p>
                </div>
              </div>

              {/* tags */}
              <div className="mt-5 flex flex-wrap gap-2">
                {bundle.tags.map((tag) => (
                  <Badge key={tag} variant="neutral" size="md">
                    {tag}
                  </Badge>
                ))}
              </div>

              {/* CTAs */}
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <AddBundleButton
                  bundleId={bundle.id}
                  label="Add bundle to cart"
                  variant="hero"
                  size="lg"
                  className="w-full sm:w-auto"
                />
                <Link
                  href="/cart"
                  className={buttonVariants({ variant: "outline", size: "lg" })}
                >
                  Customize in the bundle builder <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-success" /> Free delivery on bundles over{" "}
                {money(250)} · one coordinated drop-off
              </p>
            </div>
          </div>
        </Container>
      </section>

      <ScallopDivider />

      {/* ============================ WHAT'S INSIDE ============================ */}
      <section className="py-16 lg:py-20">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1.55fr_0.95fr] lg:gap-12">
            {/* dish list grouped by restaurant */}
            <div>
              <SectionHeading
                eyebrow="What's inside"
                title={
                  <>
                    {includedDishes.length} dishes from{" "}
                    <span className="text-gradient-sunset">{rests.length} kitchens</span>
                  </>
                }
                subtitle="Every tray is group-sized. Love something in particular? Add any single item to your bundle on its own."
              />

              <div className="mt-8 space-y-8">
                {groups.map(({ restaurant, dishes }) => (
                  <div
                    key={restaurant.id}
                    className="overflow-hidden rounded-[1.25rem] border border-border bg-surface shadow-soft"
                  >
                    {/* restaurant header */}
                    <div className="flex items-center gap-3 border-b border-border bg-muted/60 px-5 py-4">
                      <span
                        style={{ backgroundColor: restaurant.logoColor }}
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-full font-display text-base font-bold text-white shadow-sm ring-2 ring-white"
                      >
                        {restaurant.name.charAt(0)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/restaurants/${restaurant.slug}`}
                          className="font-display text-lg font-bold leading-tight text-foreground transition-colors hover:text-primary"
                        >
                          {restaurant.name}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">
                          {restaurant.tagline} · {restaurant.neighborhood}
                        </p>
                      </div>
                      <span
                        style={{ color: restaurant.logoColor }}
                        className="hidden shrink-0 text-xs font-bold uppercase tracking-[0.1em] sm:block"
                      >
                        {restaurant.cuisine}
                      </span>
                    </div>

                    {/* dish rows */}
                    <ul className="divide-y divide-border">
                      {dishes.map((dish) => (
                        <li
                          key={dish.id}
                          className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center"
                        >
                          <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-1 ring-border">
                            <FoodImage
                              src={dish.image}
                              alt={dish.name}
                              emoji="🍽️"
                              sizes="64px"
                            />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <h3 className="font-display text-base font-bold leading-tight text-foreground">
                                {dish.name}
                              </h3>
                              <span className="tnum shrink-0 font-display text-base font-bold text-primary">
                                {money(dish.price)}
                              </span>
                            </div>
                            <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                              {dish.description}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Badge variant="serves" size="sm">
                                <Users className="h-3 w-3" /> Serves {dish.serves[0]}–{dish.serves[1]}
                              </Badge>
                              {dish.dietary.length > 0 && (
                                <DietaryBadges tags={dish.dietary} max={2} />
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 sm:w-44">
                            <AddToBundle dishId={dish.id} size="sm" label="Add" />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* sticky coverage + summary rail */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-[1.25rem] border border-border bg-surface p-6 shadow-lift">
                <span className="bg-sunset mb-5 block h-1 w-12 rounded-full" aria-hidden />
                <h2 className="font-display text-xl font-bold text-foreground">
                  Coverage at a glance
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sized for {bundle.serves} guests — here&apos;s how this spread stacks up.
                </p>

                <div className="mt-5 rounded-2xl bg-muted p-4">
                  <CoverageMeter servings={bundleServings} headcount={bundle.serves} />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Provides ~{Math.round(bundleServings)} servings across{" "}
                    {includedDishes.length} trays — comfortably covering all {bundle.serves} seats.
                  </p>
                </div>

                <dl className="mt-5 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="flex items-center gap-2 text-muted-foreground">
                      <UtensilsCrossed className="h-4 w-4" /> Dishes
                    </dt>
                    <dd className="tnum font-semibold text-foreground">{includedDishes.length}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="flex items-center gap-2 text-muted-foreground">
                      <Sparkles className="h-4 w-4" /> Restaurants
                    </dt>
                    <dd className="tnum font-semibold text-foreground">{rests.length}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" /> Serves
                    </dt>
                    <dd className="tnum font-semibold text-foreground">{bundle.serves} guests</dd>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-3">
                    <dt className="flex items-center gap-2 font-semibold text-foreground">
                      <ReceiptText className="h-4 w-4" /> Bundle total
                    </dt>
                    <dd className="tnum font-display text-lg font-bold text-primary">
                      {money(total)}
                    </dd>
                  </div>
                </dl>

                <div className="mt-5">
                  <AddBundleButton
                    bundleId={bundle.id}
                    label="Add bundle to cart"
                    variant="primary"
                    size="md"
                    className="w-full"
                  />
                </div>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5" /> Schedule one coordinated delivery
                </p>
              </div>
            </aside>
          </div>
        </Container>
      </section>

      {/* ========================= WHY THIS BUNDLE WORKS ========================= */}
      <section className="bg-radial-warm py-16 lg:py-20">
        <Container>
          <SectionHeading
            align="center"
            eyebrow="Why this bundle works"
            title="Built to make everyone happy"
            subtitle="A little of everything, sized for the room, delivered as one. That's the whole idea."
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {VALUE_PROPS.map((f) => (
              <div
                key={f.title}
                className="rounded-[1.25rem] border border-border bg-surface p-7 shadow-soft transition-all hover:-translate-y-1 hover:shadow-lift"
              >
                <span
                  className="grid h-12 w-12 place-items-center rounded-2xl text-white shadow-sm"
                  style={{ backgroundColor: f.color }}
                >
                  <f.Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-bold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ============================ MORE BUNDLES ============================ */}
      <section className="py-16 lg:py-20">
        <Container>
          <div className="flex items-end justify-between gap-4">
            <SectionHeading
              eyebrow="Keep exploring"
              title="More crowd-pleasing bundles"
            />
            <Link href="/bundles" className="hidden shrink-0 sm:block">
              <Button variant="outline">
                See all bundles <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {moreBundles.map((b) => (
              <BundleCard key={b.id} bundle={b} />
            ))}
          </div>
        </Container>
      </section>

      {/* ============================== CTA BAND ============================== */}
      <section className="pb-20">
        <Container>
          <div className="bg-sunset relative overflow-hidden rounded-[2rem] px-8 py-14 text-center shadow-lift sm:px-16">
            <div className="pointer-events-none absolute -left-10 -top-10 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-12 -right-6 h-56 w-56 rounded-full bg-secondary/30 blur-3xl" />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="font-display text-3xl font-bold leading-tight tracking-[-0.02em] text-white sm:text-4xl">
                Ready to feed the room?
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-lg text-white/90">
                Add the {bundle.name} to your cart and tweak it to fit your headcount — or start a
                bundle from scratch.
              </p>
              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <AddBundleButton
                  bundleId={bundle.id}
                  label="Add bundle to cart"
                  variant="white"
                  size="lg"
                />
                <Link
                  href="/restaurants"
                  className={buttonVariants({
                    size: "lg",
                    className:
                      "bg-foreground text-white hover:bg-foreground/90 hover:-translate-y-0.5",
                  })}
                >
                  Build your own <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
