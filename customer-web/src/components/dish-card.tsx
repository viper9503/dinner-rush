import { Users } from "lucide-react";
import type { Dish } from "@/lib/types";
import { cuisineMap, restaurantMap } from "@/lib/data";
import { money } from "@/lib/utils";
import { FoodImage } from "./food-image";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { DietaryBadges } from "./dietary";
import { AddToBundle } from "./add-to-bundle";

export function DishCard({ dish, showRestaurant = false }: { dish: Dish; showRestaurant?: boolean }) {
  const c = cuisineMap[dish.cuisine];
  return (
    <Card className="flex h-full flex-col">
      <div className="relative aspect-[4/3] overflow-hidden">
        <FoodImage
          src={dish.image}
          alt={dish.name}
          emoji={c.emoji}
          sizes="(max-width:768px) 100vw, (max-width:1200px) 50vw, 25vw"
          className="transition-transform duration-500 group-hover:scale-105"
        />
        <span style={{ backgroundColor: c.color }} className="absolute inset-y-0 left-0 z-10 w-1.5" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {dish.popular && <Badge variant="popular" size="sm">🔥 Popular</Badge>}
          {dish.isNew && <Badge variant="new" size="sm">New</Badge>}
        </div>
        <Badge variant="glass" size="sm" className="absolute bottom-3 left-3 shadow-sm">
          <Users className="h-3.5 w-3.5" /> Serves {dish.serves[0]}–{dish.serves[1]}
        </Badge>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        {showRestaurant && (
          <span className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {restaurantMap[dish.restaurantId]?.name}
          </span>
        )}
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-base font-bold leading-tight text-foreground">{dish.name}</h3>
          <span className="tnum shrink-0 font-display text-lg font-bold text-primary">{money(dish.price)}</span>
        </div>
        <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{dish.description}</p>
        {dish.dietary.length > 0 && <DietaryBadges tags={dish.dietary} />}
        <div className="mt-auto pt-1">
          <AddToBundle dishId={dish.id} />
        </div>
      </div>
    </Card>
  );
}
