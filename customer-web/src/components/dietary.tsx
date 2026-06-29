import { Leaf, Sprout, WheatOff, Flame, Milk } from "lucide-react";
import type { DietaryTag } from "@/lib/types";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

const META: Record<DietaryTag, { label: string; Icon: typeof Leaf; spicy?: boolean }> = {
  vegetarian: { label: "Vegetarian", Icon: Leaf },
  vegan: { label: "Vegan", Icon: Sprout },
  "gluten-free": { label: "Gluten-free", Icon: WheatOff },
  "dairy-free": { label: "Dairy-free", Icon: Milk },
  spicy: { label: "Spicy", Icon: Flame, spicy: true },
};

export function DietaryBadges({
  tags,
  max = 3,
  className,
}: {
  tags: DietaryTag[];
  max?: number;
  className?: string;
}) {
  if (!tags.length) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {tags.slice(0, max).map((t) => {
        const m = META[t];
        return (
          <Badge key={t} variant={m.spicy ? "limited" : "dietary"} size="sm">
            <m.Icon className="h-3 w-3" />
            {m.label}
          </Badge>
        );
      })}
    </div>
  );
}
