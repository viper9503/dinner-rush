import Link from "next/link";
import { Users } from "lucide-react";
import type { CuratedBundle } from "@/lib/types";
import { bundleRestaurants } from "@/lib/data";
import { money } from "@/lib/utils";
import { FoodImage } from "./food-image";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { BundleStack } from "./bundle-stack";
import { AddBundleButton } from "./add-to-bundle";

export function BundleCard({ bundle }: { bundle: CuratedBundle }) {
  const rests = bundleRestaurants(bundle);
  return (
    <Card className="group flex h-full flex-col">
      <div className="relative aspect-[16/10] overflow-hidden">
        <FoodImage
          src={bundle.image}
          alt={bundle.name}
          emoji="🧺"
          sizes="(max-width:768px) 100vw, 50vw"
          className="transition-transform duration-500 group-hover:scale-105"
        />
        <div className="scrim absolute inset-0" />
        <Badge variant="multi" size="md" className="absolute left-3 top-3">🧺 Bundle</Badge>
        {bundle.popular && (
          <Badge variant="sunset" size="md" className="absolute right-3 top-3 shadow-sm">
            ⭐ Most Popular
          </Badge>
        )}
        <div className="absolute inset-x-4 bottom-3">
          <BundleStack restaurantIds={rests.map((r) => r.id)} size="sm" />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <span className="text-xs font-bold uppercase tracking-[0.12em] text-secondary">{bundle.theme}</span>
        <h3 className="mt-1 font-display text-xl font-bold leading-tight text-foreground transition-colors group-hover:text-primary">
          {bundle.name}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{bundle.tagline}</p>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <div className="tnum font-display text-2xl font-bold text-foreground">
              {money(bundle.pricePerPerson)}
              <span className="text-sm font-medium text-muted-foreground">/person</span>
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> Serves {bundle.serves} · {rests.length} restaurants
            </div>
          </div>
          <AddBundleButton bundleId={bundle.id} />
        </div>
      </div>
      {/* stretched link overlay (keeps the Add button clickable above it) */}
      <Link href={`/bundles/${bundle.slug}`} className="absolute inset-0 z-0">
        <span className="sr-only">View {bundle.name}</span>
      </Link>
    </Card>
  );
}
