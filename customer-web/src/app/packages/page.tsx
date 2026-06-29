import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Sparkles, Users } from "lucide-react";
import { cuisineMap, packageRestaurants, packages } from "@/lib/data";
import { Container, SectionHeading } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { FoodImage } from "@/components/food-image";
import { BundleStack } from "@/components/bundle-stack";

export const metadata: Metadata = {
  title: "Catering packages · Dinner Rush",
  description: "Build-your-own catering packages — pick your mains, sides and dessert, sized to your headcount.",
};

export default function PackagesPage() {
  return (
    <section className="bg-radial-warm min-h-screen py-14">
      <Container>
        <SectionHeading
          align="center"
          eyebrow="Order by package"
          title="Customizable catering packages"
          subtitle="Prefer a guided spread? Pick a package, choose your options for each course, set the headcount — we size and source everything across kitchens."
        />

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
          {packages.map((p) => {
            const restaurants = packageRestaurants(p);
            const cuisine = cuisineMap[p.cuisine];
            return (
              <Link
                key={p.id}
                href={`/packages/${p.slug}`}
                className="group relative overflow-hidden rounded-[1.5rem] border border-border bg-surface shadow-soft transition hover:-translate-y-1 hover:shadow-lift"
              >
                <span className="absolute left-0 top-0 z-10 h-full w-1.5" style={{ backgroundColor: cuisine.color }} />
                <div className="relative h-44 overflow-hidden">
                  <FoodImage src={p.image} alt={p.name} emoji={cuisine.emoji} sizes="(max-width:768px) 100vw, 50vw" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                  {p.popular && (
                    <Badge variant="sunset" size="sm" className="absolute left-4 top-4 shadow">
                      <Sparkles className="h-3 w-3" /> Popular
                    </Badge>
                  )}
                  <div className="absolute bottom-3 left-5 right-5 flex items-end justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-white/80">{p.theme}</p>
                      <h3 className="font-display text-2xl font-bold text-white">{p.name}</h3>
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-sm text-muted-foreground">{p.tagline}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <BundleStack restaurantIds={restaurants.map((r) => r.id)} />
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <Users className="h-3.5 w-3.5" /> {p.minGuests}+ guests
                    </span>
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary">
                    Customize <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
