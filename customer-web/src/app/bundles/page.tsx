import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Users, Truck, ReceiptText, Sparkles } from "lucide-react";
import { bundles, bundleRestaurants } from "@/lib/data";
import { money } from "@/lib/utils";
import { Container, Eyebrow, ScallopDivider } from "@/components/section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FoodImage } from "@/components/food-image";
import { BundleStack } from "@/components/bundle-stack";
import { AddBundleButton } from "@/components/add-to-bundle";
import { BundleGrid } from "./bundle-grid";

export const metadata: Metadata = {
  title: "Curated bundles — Dinner Rush",
  description:
    "Crowd-pleasing, multi-restaurant catering spreads priced per person. Ready-made bundles that mix the city's best kitchens into one balanced, hassle-free delivery.",
};

export default function BundlesPage() {
  const featured = bundles.find((b) => b.popular) ?? bundles[0];
  const featuredRests = bundleRestaurants(featured);
  const featuredTotal = featured.pricePerPerson * featured.serves;

  return (
    <>
      {/* ============================ HEADER BAND ============================ */}
      <section className="bg-grape relative overflow-hidden text-white">
        <div className="pointer-events-none absolute -left-24 -top-16 h-72 w-72 rounded-full bg-white/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 top-24 h-80 w-80 rounded-full bg-accent/25 blur-3xl" />
        <div className="animate-float-slower pointer-events-none absolute right-[12%] top-10 hidden text-5xl opacity-90 lg:block">
          🧺
        </div>
        <div className="animate-float-slow pointer-events-none absolute right-[28%] bottom-12 hidden text-4xl opacity-80 lg:block">
          🍱
        </div>

        <Container className="relative py-16 sm:py-20">
          <div className="max-w-2xl">
            <Eyebrow className="text-white/90">Curated bundles</Eyebrow>
            <h1 className="mt-3 font-display text-[clamp(2.25rem,5vw,3.75rem)] font-bold leading-[1.02] tracking-[-0.03em]">
              Crowd-pleasing spreads, ready to roll
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/85">
              Skip the spreadsheet. Each bundle mixes dishes from several local kitchens into one
              perfectly balanced feast — sized for a crowd and priced simply per person.
            </p>

            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-white/90">
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" /> Multi-restaurant by design
              </span>
              <span className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-accent" /> One coordinated delivery
              </span>
              <span className="flex items-center gap-2">
                <ReceiptText className="h-4 w-4 text-accent" /> One simple invoice
              </span>
            </div>
          </div>
        </Container>

        <ScallopDivider flip />
      </section>

      {/* ============================ FEATURED HERO ============================ */}
      <section className="py-16 sm:py-20">
        <Container>
          <div className="mb-8 flex items-center gap-3">
            <Eyebrow>Featured this week</Eyebrow>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="relative grid overflow-hidden rounded-[2rem] border border-border bg-surface shadow-lift lg:grid-cols-2">
            <span className="bg-sunset absolute inset-x-0 top-0 z-10 h-1.5" />

            {/* image side */}
            <div className="relative min-h-[280px] overflow-hidden lg:min-h-[480px]">
              <FoodImage
                src={featured.image}
                alt={featured.name}
                emoji="🧺"
                sizes="(max-width:1024px) 100vw, 50vw"
                priority
                className="transition-transform duration-700 hover:scale-105"
              />
              <div className="scrim absolute inset-0" />
              {featured.popular && (
                <Badge variant="sunset" size="lg" className="absolute left-5 top-7 shadow-lift">
                  ⭐ Most Popular
                </Badge>
              )}
              <div className="absolute inset-x-5 bottom-5">
                <BundleStack restaurantIds={featuredRests.map((r) => r.id)} size="md" />
              </div>
            </div>

            {/* content side */}
            <div className="flex flex-col gap-5 p-7 sm:p-10">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="multi" size="md">
                  {featuredRests.length} restaurants
                </Badge>
                <Badge variant="popular" size="md" className="uppercase tracking-[0.12em]">
                  {featured.theme}
                </Badge>
              </div>

              <div>
                <h2 className="font-display text-3xl font-bold leading-tight tracking-[-0.02em] text-foreground sm:text-4xl">
                  {featured.name}
                </h2>
                <p className="mt-1 text-base font-semibold text-secondary">{featured.tagline}</p>
              </div>

              <p className="text-[1.0625rem] leading-relaxed text-muted-foreground">
                {featured.description}
              </p>

              {/* price + serves panel */}
              <div className="flex flex-wrap items-end gap-x-8 gap-y-4 rounded-[1.25rem] bg-muted p-5">
                <div>
                  <div className="tnum font-display text-4xl font-bold leading-none text-foreground">
                    {money(featured.pricePerPerson)}
                    <span className="text-base font-medium text-muted-foreground">/person</span>
                  </div>
                  <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" /> Serves {featured.serves} people
                  </p>
                </div>
                <div className="hidden h-12 w-px bg-border sm:block" />
                <div>
                  <div className="tnum font-display text-2xl font-bold leading-none text-foreground">
                    {money(featuredTotal)}
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">Estimated total</p>
                </div>
              </div>

              {/* tags */}
              <div className="flex flex-wrap gap-2">
                {featured.tags.map((t) => (
                  <Badge key={t} variant="neutral" size="md">
                    {t}
                  </Badge>
                ))}
              </div>

              {/* actions */}
              <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center">
                <AddBundleButton
                  bundleId={featured.id}
                  size="lg"
                  label="Add bundle to cart"
                  className="w-full sm:w-auto"
                />
                <Link href={`/bundles/${featured.slug}`} className="w-full sm:w-auto">
                  <Button variant="outline" size="lg" className="w-full">
                    View bundle <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ============================ ALL BUNDLES GRID ============================ */}
      <section className="bg-radial-warm py-16 sm:py-20">
        <Container>
          <div className="mb-8 max-w-2xl">
            <Eyebrow>All bundles</Eyebrow>
            <h2 className="mt-3 font-display text-3xl font-bold leading-[1.05] tracking-[-0.02em] text-foreground sm:text-4xl">
              Every spread, sized for the room
            </h2>
            <p className="mt-3 text-[1.0625rem] leading-relaxed text-muted-foreground">
              Filter by theme to find the right vibe, then add it to your cart in one tap. We size
              every dish to your headcount automatically.
            </p>
          </div>

          <BundleGrid bundles={bundles} />
        </Container>
      </section>

      {/* ============================ CLOSING CTA BAND ============================ */}
      <section className="py-20">
        <Container>
          <div className="bg-sunset relative overflow-hidden rounded-[2rem] px-8 py-16 text-center shadow-lift sm:px-16">
            <div className="pointer-events-none absolute -left-10 -top-10 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-12 -right-6 h-56 w-56 rounded-full bg-secondary/30 blur-3xl" />
            <div className="relative mx-auto max-w-2xl">
              <Badge variant="glass" size="lg" className="mb-5 shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Total control
              </Badge>
              <h2 className="font-display text-4xl font-bold leading-tight tracking-[-0.02em] text-white sm:text-5xl">
                Want full control? Build your own bundle
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-white/90">
                Start from a blank cart and mix any dishes from any restaurants. Our live coverage
                meter keeps every seat fed — no over-ordering, no guesswork.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/restaurants">
                  <Button variant="white" size="lg">
                    Browse restaurants <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/restaurants">
                  <Button
                    size="lg"
                    className="bg-foreground text-white hover:bg-foreground/90 hover:-translate-y-0.5"
                  >
                    Start a custom bundle
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
