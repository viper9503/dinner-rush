import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { cuisineMap } from "@/lib/data";
import { Container } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { HeadcountStepper } from "@/components/headcount-stepper";
import { RestaurantsBrowser } from "./restaurants-browser";

export const metadata: Metadata = {
  title: "Browse restaurants — Dinner Rush",
  description:
    "Discover the city's best local kitchens and bundle dishes from as many as you like into a single, headcount-sized group order.",
};

export default async function RestaurantsPage({
  searchParams,
}: {
  searchParams: Promise<{ cuisine?: string }>;
}) {
  const { cuisine } = await searchParams;
  const initialCuisine = cuisine && cuisineMap[cuisine] ? cuisine : "all";

  return (
    <>
      {/* ============================ HEADER BAND ============================ */}
      <section className="bg-radial-warm relative overflow-hidden">
        <div className="pointer-events-none absolute -left-32 top-8 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
        <div className="pointer-events-none absolute right-[-6rem] top-24 h-80 w-80 rounded-full bg-accent-alt/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-4rem] left-1/3 h-64 w-64 rounded-full bg-secondary/15 blur-3xl" />
        <Container className="relative py-14 sm:py-16 lg:py-20">
          <div className="max-w-3xl">
            <Badge variant="glass" size="lg" className="mb-5 shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Browse the city
            </Badge>
            <h1 className="font-display text-[clamp(2.5rem,5.5vw,4rem)] font-bold leading-[0.98] tracking-[-0.03em] text-foreground">
              Every kitchen,{" "}
              <span className="text-gradient-sunset">one bundle</span>.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Hand-picked local restaurants, all in one place. Mix tacos, ramen,
              brisket and a salad bar across as many kitchens as you like — it
              still lands as a single delivery and one tidy invoice.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2.5 rounded-full bg-white/70 px-3 py-2 ring-1 ring-border">
                <span className="text-sm font-semibold text-foreground">Feeding</span>
                <HeadcountStepper size="sm" />
              </div>
              <span className="max-w-xs text-sm text-muted-foreground">
                We size every dish for your headcount — nobody goes hungry, you
                never over-order.
              </span>
            </div>
          </div>
        </Container>
      </section>

      {/* ============================== BROWSER ============================== */}
      <RestaurantsBrowser initialCuisine={initialCuisine} />
    </>
  );
}
