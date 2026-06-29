import Link from "next/link";
import { Star, Clock } from "lucide-react";
import type { Restaurant } from "@/lib/types";
import { cuisineMap } from "@/lib/data";
import { money } from "@/lib/utils";
import { FoodImage } from "./food-image";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";

export function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  const c = cuisineMap[restaurant.cuisine];
  return (
    <Link href={`/restaurants/${restaurant.slug}`} className="group block">
      <Card className="h-full">
        <div className="relative aspect-[4/3] overflow-hidden">
          <FoodImage
            src={restaurant.image}
            alt={restaurant.name}
            emoji={c.emoji}
            sizes="(max-width:768px) 100vw, (max-width:1200px) 50vw, 33vw"
            className="transition-transform duration-500 group-hover:scale-105"
          />
          <div className="scrim absolute inset-0" />
          <span style={{ backgroundColor: c.color }} className="absolute inset-y-0 left-0 w-1.5" />
          <Badge variant="glass" size="sm" className="absolute left-3 top-3">
            <span>{c.emoji}</span> {c.label}
          </Badge>
          {restaurant.badges?.[0] && (
            <Badge variant="sunset" size="sm" className="absolute right-3 top-3 shadow-sm">
              {restaurant.badges[0]}
            </Badge>
          )}
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-between text-white">
            <span className="tnum flex items-center gap-1 text-sm font-bold">
              <Star className="h-4 w-4 fill-accent text-accent" />
              {restaurant.rating}
              <span className="font-medium opacity-80">({restaurant.reviews})</span>
            </span>
            <span className="text-xs font-medium opacity-90">{restaurant.neighborhood}</span>
          </div>
        </div>
        <div className="p-5">
          <h3 className="font-display text-lg font-bold leading-tight text-foreground transition-colors group-hover:text-primary">
            {restaurant.name}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{restaurant.tagline}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {restaurant.prepTime}
            </span>
            <span aria-hidden>·</span>
            <span className="tnum">Min {money(restaurant.minOrder)}</span>
            <span aria-hidden>·</span>
            <span className="font-semibold text-foreground/70">{"$".repeat(restaurant.priceLevel)}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
