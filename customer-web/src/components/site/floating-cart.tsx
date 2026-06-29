"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ShoppingBag, X, Minus, Plus, ArrowRight, Sparkles } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { money } from "@/lib/utils";
import { cuisineMap } from "@/lib/data";
import { FoodImage } from "../food-image";
import { CoverageMeter } from "../coverage-meter";
import { HeadcountStepper } from "../headcount-stepper";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

export function FloatingCart() {
  const cart = useCart();
  const pathname = usePathname();
  const {
    isCartOpen,
    openCart,
    closeCart,
    grouped,
    itemCount,
    restaurantCount,
    headcount,
    totalServings,
    subtotal,
    deliveryFee,
    serviceFee,
    tax,
    total,
    perPerson,
    increment,
    decrement,
    hydrated,
    justAdded,
  } = cart;

  useEffect(() => {
    document.body.style.overflow = isCartOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isCartOpen]);

  const hideDock = pathname === "/cart" || pathname.startsWith("/checkout") || pathname.startsWith("/order");
  const thumbs = grouped.flatMap((g) => g.lines).slice(0, 3);

  return (
    <>
      {/* floating dock */}
      <AnimatePresence>
        {hydrated && itemCount > 0 && !isCartOpen && !hideDock && (
          <motion.button
            type="button"
            onClick={openCart}
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="glass fixed bottom-5 right-5 z-40 flex items-center gap-3 rounded-full py-2.5 pl-2.5 pr-5 shadow-lift"
          >
            <span className="absolute inset-x-6 -top-px h-0.5 rounded-full bg-sunset" />
            <span className="flex -space-x-3">
              {thumbs.map(({ dish }) => (
                <span key={dish.id} className="relative h-9 w-9 overflow-hidden rounded-full ring-2 ring-white">
                  <FoodImage src={dish.image} alt={dish.name} emoji={cuisineMap[dish.cuisine].emoji} sizes="36px" />
                </span>
              ))}
            </span>
            <span className="text-left">
              <span className="block text-xs font-semibold text-muted-foreground">
                {itemCount} {itemCount === 1 ? "item" : "items"} · {restaurantCount} {restaurantCount === 1 ? "spot" : "spots"}
              </span>
              <span className="tnum block font-display text-base font-bold text-foreground">{money(total)}</span>
            </span>
            <motion.span
              key={justAdded}
              animate={justAdded ? { scale: [1, 1.25, 1] } : {}}
              className="grid h-9 w-9 place-items-center rounded-full bg-primary text-white"
            >
              <ShoppingBag className="h-4 w-4" />
            </motion.span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeCart}
              className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 36 }}
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-background shadow-2xl"
            >
              <div className="bg-sunset h-1.5 w-full shrink-0" />
              <header className="flex items-center justify-between gap-3 px-5 py-4">
                <div>
                  <h2 className="font-display text-xl font-bold text-foreground">Your bundle</h2>
                  <p className="text-xs text-muted-foreground">
                    {itemCount} items from {restaurantCount} {restaurantCount === 1 ? "restaurant" : "restaurants"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeCart}
                  aria-label="Close"
                  className="grid h-10 w-10 place-items-center rounded-full border border-border bg-surface text-foreground transition hover:bg-muted"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              {itemCount === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
                  <div className="grid h-20 w-20 place-items-center rounded-full bg-muted text-4xl">🧺</div>
                  <p className="font-display text-lg font-bold text-foreground">Your bundle is empty</p>
                  <p className="text-sm text-muted-foreground">Add dishes from any restaurants — mix and match freely.</p>
                  <Link href="/restaurants" onClick={closeCart}>
                    <Button variant="hero">Browse restaurants</Button>
                  </Link>
                </div>
              ) : (
                <>
                  <div className="border-y border-border bg-muted/50 px-5 py-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">Feeding {headcount} guests</span>
                      <HeadcountStepper size="sm" />
                    </div>
                    <CoverageMeter servings={totalServings} headcount={headcount} />
                  </div>

                  <div className="flex-1 overflow-y-auto px-5 py-4">
                    <div className="space-y-6">
                      {grouped.map((g) => (
                        <div key={g.restaurant.id}>
                          <div className="mb-2.5 flex items-center gap-2">
                            <span
                              style={{ backgroundColor: g.restaurant.logoColor }}
                              className="grid h-6 w-6 place-items-center rounded-full text-[0.65rem] font-bold text-white"
                            >
                              {g.restaurant.name.charAt(0)}
                            </span>
                            <span className="font-display text-sm font-bold text-foreground">{g.restaurant.name}</span>
                            <Badge variant="neutral" size="sm" className="ml-auto">
                              {cuisineMap[g.restaurant.cuisine].emoji} {cuisineMap[g.restaurant.cuisine].label}
                            </Badge>
                          </div>
                          <div className="space-y-2.5">
                            {g.lines.map(({ dish, qty }) => (
                              <div key={dish.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-2.5">
                                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                                  <FoodImage src={dish.image} alt={dish.name} emoji={cuisineMap[dish.cuisine].emoji} sizes="56px" />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-foreground">{dish.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Serves {dish.serves[0]}–{dish.serves[1]} · <span className="tnum font-semibold text-primary">{money(dish.price)}</span>
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 rounded-full bg-muted p-1">
                                  <button
                                    type="button"
                                    aria-label="Remove one"
                                    onClick={() => decrement(dish.id)}
                                    className="grid h-7 w-7 place-items-center rounded-full bg-white text-foreground shadow-sm transition hover:text-primary"
                                  >
                                    <Minus className="h-3.5 w-3.5" />
                                  </button>
                                  <span className="tnum w-4 text-center text-sm font-bold">{qty}</span>
                                  <button
                                    type="button"
                                    aria-label="Add one"
                                    onClick={() => increment(dish.id)}
                                    className="grid h-7 w-7 place-items-center rounded-full bg-primary text-white shadow-sm transition hover:bg-primary-bright"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="shrink-0 border-t border-border bg-surface px-5 py-4">
                    <dl className="space-y-1.5 text-sm">
                      <Row label="Subtotal" value={money(subtotal)} />
                      <Row label="Delivery" value={deliveryFee === 0 ? "FREE" : money(deliveryFee)} accent={deliveryFee === 0} />
                      <Row label="Service" value={money(serviceFee)} />
                      <Row label="Est. tax" value={money(tax)} />
                      <div className="mt-2 flex items-center justify-between border-t border-border pt-2.5">
                        <span className="font-display text-base font-bold text-foreground">Total</span>
                        <span className="tnum font-display text-xl font-bold text-foreground">{money(total)}</span>
                      </div>
                      <p className="tnum text-right text-xs text-muted-foreground">≈ {money(perPerson, true)} / guest</p>
                    </dl>
                    <Link href="/checkout" onClick={closeCart} className="mt-3 block">
                      <Button variant="hero" size="lg" className="w-full">
                        Go to checkout <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link href="/cart" onClick={closeCart} className="mt-2 block">
                      <Button variant="ghost" className="w-full">
                        <Sparkles className="h-4 w-4" /> View full bundle
                      </Button>
                    </Link>
                  </div>
                </>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={accent ? "tnum font-bold text-success" : "tnum font-medium text-foreground"}>{value}</dd>
    </div>
  );
}
