"use client";

import Link from "next/link";
import { ShieldCheck, Truck } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { cuisineMap } from "@/lib/data";
import { money } from "@/lib/utils";
import { FoodImage } from "@/components/food-image";
import { CoverageMeter } from "@/components/coverage-meter";
import { BundleStack } from "@/components/bundle-stack";
import { Badge } from "@/components/ui/badge";

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={accent ? "tnum font-bold text-success" : "tnum font-medium text-foreground"}>
        {value}
      </dd>
    </div>
  );
}

/** Sticky condensed bundle summary used in the checkout right rail. */
export function OrderSummary() {
  const {
    grouped,
    restaurantIds,
    restaurantCount,
    headcount,
    totalServings,
    itemCount,
    subtotal,
    deliveryFee,
    serviceFee,
    tax,
    total,
    perPerson,
    hydrated,
  } = useCart();

  if (hydrated && itemCount === 0) {
    return (
      <div className="rounded-[1.25rem] border border-border bg-surface p-6 text-center shadow-soft">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-muted text-3xl">🧺</div>
        <p className="mt-3 font-display text-base font-bold text-foreground">Your bundle is empty</p>
        <p className="mt-1 text-sm text-muted-foreground">Add some dishes before you check out.</p>
        <Link
          href="/restaurants"
          className="mt-4 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_8px_20px_-6px_rgba(232,67,31,0.5)] transition hover:bg-primary-bright"
        >
          Browse restaurants
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-border bg-surface shadow-lift">
      <div className="bg-sunset h-1.5 w-full" />
      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-foreground">Order summary</h2>
          <Badge variant="multi" size="md">
            {restaurantCount} {restaurantCount === 1 ? "spot" : "spots"}
          </Badge>
        </div>
        <BundleStack restaurantIds={restaurantIds} className="mt-3" showChip={false} />

        {/* condensed lines */}
        <div className="mt-5 max-h-72 space-y-4 overflow-y-auto pr-1">
          {grouped.map((g) => (
            <div key={g.restaurant.id}>
              <div className="mb-2 flex items-center gap-2">
                <span
                  style={{ backgroundColor: g.restaurant.logoColor }}
                  className="grid h-5 w-5 place-items-center rounded-full text-[0.6rem] font-bold text-white"
                >
                  {g.restaurant.name.charAt(0)}
                </span>
                <span className="truncate font-display text-[0.8125rem] font-bold text-foreground">
                  {g.restaurant.name}
                </span>
              </div>
              <div className="space-y-2">
                {g.lines.map(({ dish, qty }) => (
                  <div key={dish.id} className="flex items-center gap-2.5">
                    <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl">
                      <FoodImage
                        src={dish.image}
                        alt={dish.name}
                        emoji={cuisineMap[dish.cuisine].emoji}
                        sizes="44px"
                      />
                      {qty > 1 && (
                        <span className="tnum absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-foreground px-1 text-[0.625rem] font-bold text-white ring-2 ring-surface">
                          {qty}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.8125rem] font-semibold text-foreground">
                        {dish.name}
                      </span>
                      <span className="block text-[0.6875rem] text-muted-foreground">
                        Serves {dish.serves[0]}–{dish.serves[1]}
                      </span>
                    </span>
                    <span className="tnum shrink-0 text-[0.8125rem] font-semibold text-foreground">
                      {money(dish.price * qty)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* coverage */}
        <div className="mt-5 rounded-2xl bg-muted p-4">
          <CoverageMeter servings={totalServings} headcount={headcount} />
          <p className="mt-2 flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
            <Truck className="h-3.5 w-3.5" />
            Feeding {headcount} guests · {itemCount} {itemCount === 1 ? "tray" : "trays"}
          </p>
        </div>

        {/* totals */}
        <dl className="mt-5 space-y-1.5 text-sm">
          <Row label="Subtotal" value={money(subtotal)} />
          <Row
            label="Delivery"
            value={deliveryFee === 0 ? "FREE" : money(deliveryFee)}
            accent={deliveryFee === 0}
          />
          <Row label="Service" value={money(serviceFee)} />
          <Row label="Est. tax" value={money(tax)} />
          <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
            <span className="font-display text-base font-bold text-foreground">Total</span>
            <span className="tnum font-display text-2xl font-bold text-foreground">{money(total)}</span>
          </div>
          <p className="tnum text-right text-xs text-muted-foreground">
            ≈ {money(perPerson, true)} per guest
          </p>
        </dl>

        {deliveryFee === 0 && subtotal > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-success/10 px-3 py-2.5 text-xs font-semibold text-success">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Free delivery unlocked — your order is over $250.
          </div>
        )}
      </div>
    </div>
  );
}
