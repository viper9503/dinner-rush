import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  MapPin,
  Star,
  Users,
  Wallet,
} from "lucide-react";
import {
  cuisineMap,
  dishes,
  dishesByRestaurant,
  restaurants,
} from "@/lib/data";
import { money } from "@/lib/utils";
import { Container, SectionHeading } from "@/components/section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FoodImage } from "@/components/food-image";
import { DishCard } from "@/components/dish-card";
import { StickyMenuBar } from "./sticky-menu-bar";

export function generateStaticParams() {
  return restaurants.map((r) => ({ slug: r.slug }));
}

/** Turn a category label into a stable, URL-safe anchor id. */
const anchorId = (label: string) =>
  `menu-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurant = restaurants.find((r) => r.slug === slug);
  if (!restaurant) return { title: "Restaurant — Dinner Rush" };
  return {
    title: `${restaurant.name} — Dinner Rush`,
    description: restaurant.tagline,
  };
}

export default async function RestaurantPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurant = restaurants.find((r) => r.slug === slug);
  if (!restaurant) notFound();

  const cuisine = cuisineMap[restaurant.cuisine];
  const menu = dishesByRestaurant(restaurant.id);

  // Group dishes by category, preserving first-seen order.
  const categoryOrder: string[] = [];
  const byCategory = new Map<string, typeof menu>();
  for (const dish of menu) {
    if (!byCategory.has(dish.category)) {
      byCategory.set(dish.category, []);
      categoryOrder.push(dish.category);
    }
    byCategory.get(dish.category)!.push(dish);
  }

  const categories = categoryOrder.map((label) => ({
    id: anchorId(label),
    label,
  }));

  // Cross-sell: appetizing picks from OTHER restaurants of DIFFERENT cuisines.
  const seenCuisines = new Set<string>([restaurant.cuisine]);
  const pairings: typeof dishes = [];
  for (const dish of dishes) {
    if (dish.restaurantId === restaurant.id) continue;
    if (seenCuisines.has(dish.cuisine)) continue;
    if (!dish.popular) continue;
    seenCuisines.add(dish.cuisine);
    pairings.push(dish);
    if (pairings.length === 4) break;
  }

  const totalDishes = menu.length;

  return (
    <>
      {/* ============================ HERO ============================ */}
      <section className="relative h-[320px] overflow-hidden sm:h-[400px]">
        <FoodImage
          src={restaurant.image}
          alt={restaurant.name}
          emoji={cuisine.emoji}
          sizes="100vw"
          priority
        />
        {/* cuisine-color left rail */}
        <span
          style={{ backgroundColor: cuisine.color }}
          className="absolute inset-y-0 left-0 z-20 w-1.5 sm:w-2.5"
        />
        {/* scrims for legible white text */}
        <div className="scrim absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-r from-foreground/55 via-foreground/10 to-transparent" />

        <Container className="relative z-10 flex h-full flex-col justify-end pb-7 sm:pb-10">
          <Link
            href="/restaurants"
            className="glass absolute left-5 top-6 inline-flex items-center gap-1.5 self-start rounded-full px-3.5 py-2 text-sm font-semibold text-foreground transition hover:-translate-y-0.5 sm:left-8"
          >
            <ArrowLeft className="h-4 w-4" /> All restaurants
          </Link>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="glass" size="md">
              <span>{cuisine.emoji}</span> {cuisine.label}
            </Badge>
            {restaurant.badges?.map((b) => (
              <Badge key={b} variant="sunset" size="md" className="shadow-sm">
                {b}
              </Badge>
            ))}
          </div>

          <h1 className="font-display text-[clamp(2.25rem,5vw,3.75rem)] font-bold leading-[0.98] tracking-[-0.03em] text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.35)]">
            {restaurant.name}
          </h1>
          <p className="mt-2 max-w-xl text-base text-white/90 drop-shadow-[0_1px_8px_rgba(0,0,0,0.4)] sm:text-lg">
            {restaurant.tagline}
          </p>

          {/* meta row */}
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-medium text-white">
            <span className="tnum flex items-center gap-1.5">
              <Star className="h-4 w-4 fill-accent text-accent" />
              <span className="font-bold">{restaurant.rating}</span>
              <span className="text-white/75">({restaurant.reviews} reviews)</span>
            </span>
            <span aria-hidden className="text-white/40">
              ·
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-white/80" />
              {restaurant.neighborhood}
            </span>
            <span aria-hidden className="text-white/40">
              ·
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-white/80" />
              {restaurant.prepTime}
            </span>
            <span aria-hidden className="text-white/40">
              ·
            </span>
            <span className="tnum flex items-center gap-1.5">
              <Wallet className="h-4 w-4 text-white/80" />
              Min {money(restaurant.minOrder)}
            </span>
            <span aria-hidden className="text-white/40">
              ·
            </span>
            <span className="font-bold tracking-wide text-accent">
              {"$".repeat(restaurant.priceLevel)}
            </span>
          </div>
        </Container>
      </section>

      {/* ======================= STICKY SUB-BAR ======================= */}
      <StickyMenuBar categories={categories} accent={cuisine.color} />

      {/* ============================ MENU ============================ */}
      <section className="py-12 sm:py-16">
        <Container>
          {/* intro strip */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.25rem] border border-border bg-surface p-5 shadow-soft sm:p-6">
            <div className="flex items-center gap-4">
              <span
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-2xl"
                style={{ backgroundColor: `${cuisine.color}1a` }}
              >
                {cuisine.emoji}
              </span>
              <div>
                <p className="font-display text-lg font-bold text-foreground">
                  The menu — built for groups
                </p>
                <p className="text-sm text-muted-foreground">
                  {totalDishes} group-sized trays across {categories.length}{" "}
                  {categories.length === 1 ? "section" : "sections"}. Add any to
                  your bundle and keep mixing kitchens.
                </p>
              </div>
            </div>
            <Badge variant="multi" size="lg" className="shrink-0">
              <Users className="h-3.5 w-3.5" /> Sized by headcount
            </Badge>
          </div>

          {categoryOrder.map((category) => {
            const items = byCategory.get(category)!;
            return (
              <div
                key={category}
                id={anchorId(category)}
                className="scroll-mt-32 pt-12 first:pt-10"
              >
                <SectionHeading
                  eyebrow={`${items.length} ${items.length === 1 ? "tray" : "trays"}`}
                  title={category}
                />
                <div className="mt-7 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {items.map((dish) => (
                    <DishCard key={dish.id} dish={dish} />
                  ))}
                </div>
              </div>
            );
          })}
        </Container>
      </section>

      {/* ===================== PAIRS WELL CROSS-SELL ===================== */}
      {pairings.length > 0 && (
        <section className="bg-radial-warm py-16 sm:py-20">
          <Container>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <SectionHeading
                eyebrow="Mix more kitchens"
                title={
                  <>
                    Pairs well from{" "}
                    <span className="text-gradient-sunset">other kitchens</span>
                  </>
                }
                subtitle="That's the magic of Dinner Rush — round out your spread with crowd-pleasers from across the city, all on one delivery and one invoice."
              />
              <Link href="/restaurants" className="hidden shrink-0 sm:block">
                <Button variant="outline">
                  Browse all restaurants <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="mt-9 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {pairings.map((dish) => (
                <DishCard key={dish.id} dish={dish} showRestaurant />
              ))}
            </div>
            <div className="mt-8 sm:hidden">
              <Link href="/restaurants" className="block">
                <Button variant="outline" className="w-full">
                  Browse all restaurants <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </Container>
        </section>
      )}
    </>
  );
}
