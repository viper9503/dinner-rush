"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ShoppingBag, Utensils } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { cn } from "@/lib/utils";
import { Container } from "../section";
import { HeadcountStepper } from "../headcount-stepper";

const LINKS = [
  { href: "/restaurants", label: "Restaurants" },
  { href: "/packages", label: "Packages" },
  { href: "/bundles", label: "Bundles" },
];

export function Navbar() {
  const pathname = usePathname();
  const { itemCount, openCart, hydrated, justAdded } = useCart();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-scrolled={scrolled}
      className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl transition-shadow data-[scrolled=true]:shadow-[0_8px_24px_-16px_rgba(26,11,46,0.22)]"
    >
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-sunset shadow-[0_6px_16px_-4px_rgba(232,67,31,0.6)]">
            <Utensils className="h-5 w-5 text-white" />
          </span>
          <span className="text-gradient-sunset font-display text-xl font-extrabold tracking-[-0.02em]">
            Dinner Rush
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const active = l.href !== "/#how-it-works" && pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "relative rounded-full px-4 py-2 text-[15px] font-medium transition-colors hover:text-primary",
                  active ? "text-primary" : "text-foreground/80",
                )}
              >
                {l.label}
                {active && (
                  <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-sunset" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden lg:block">
            <HeadcountStepper size="sm" />
          </div>

          <motion.button
            type="button"
            onClick={openCart}
            key={justAdded}
            animate={justAdded ? { scale: [1, 1.12, 1] } : {}}
            transition={{ duration: 0.3 }}
            className="relative flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_8px_20px_-6px_rgba(232,67,31,0.5)] transition hover:bg-primary-bright hover:-translate-y-0.5"
          >
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">Your bundle</span>
            {hydrated && itemCount > 0 && (
              <span className="tnum grid h-5 min-w-5 place-items-center rounded-full bg-accent-alt px-1 text-[11px] font-bold text-white ring-2 ring-primary">
                {itemCount}
              </span>
            )}
          </motion.button>
        </div>
      </Container>
    </header>
  );
}
