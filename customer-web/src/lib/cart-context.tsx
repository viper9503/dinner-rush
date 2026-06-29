"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CartItem, Dish, Restaurant } from "./types";
import { bundleMap, dishMap, restaurantMap } from "./data";
import { servesAvg } from "./utils";

const STORAGE_KEY = "dinner-rush-cart-v1";
const FREE_DELIVERY_OVER = 250;
const DELIVERY_FEE = 35;

interface GroupedRestaurant {
  restaurant: Restaurant;
  lines: { dish: Dish; qty: number }[];
  subtotal: number;
  servings: number;
}

interface CartValue {
  hydrated: boolean;
  items: CartItem[];
  headcount: number;
  setHeadcount: (n: number) => void;
  bumpHeadcount: (delta: number) => void;
  add: (dishId: string, qty?: number) => void;
  addBundle: (bundleId: string) => void;
  remove: (dishId: string) => void;
  setQty: (dishId: string, qty: number) => void;
  increment: (dishId: string) => void;
  decrement: (dishId: string) => void;
  clear: () => void;
  qtyOf: (dishId: string) => number;

  itemCount: number;
  distinctDishes: number;
  restaurantIds: string[];
  restaurantCount: number;
  grouped: GroupedRestaurant[];

  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  tax: number;
  total: number;
  perPerson: number;

  totalServings: number;
  coverageRatio: number;
  covered: boolean;

  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  justAdded: number; // increment counter to trigger bounce
}

const CartContext = createContext<CartValue | null>(null);

const SEED: { items: CartItem[]; headcount: number } = {
  headcount: 40,
  items: [
    { dishId: "fuego-1", qty: 1 },
    { dishId: "sakura-1", qty: 1 },
    { dishId: "verde-2", qty: 1 },
  ],
};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [items, setItems] = useState<CartItem[]>(SEED.items);
  const [headcount, setHeadcountState] = useState<number>(SEED.headcount);
  const [isCartOpen, setCartOpen] = useState(false);
  const [justAdded, setJustAdded] = useState(0);
  const didLoad = useRef(false);

  // hydrate from localStorage (or keep seed on first ever visit)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.items)) setItems(parsed.items);
        if (typeof parsed.headcount === "number") setHeadcountState(parsed.headcount);
      }
    } catch {
      /* ignore */
    }
    didLoad.current = true;
    setHydrated(true);
  }, []);

  // persist
  useEffect(() => {
    if (!didLoad.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, headcount }));
    } catch {
      /* ignore */
    }
  }, [items, headcount]);

  const setHeadcount = (n: number) => setHeadcountState(Math.max(1, Math.min(500, Math.round(n))));
  const bumpHeadcount = (delta: number) => setHeadcountState((h) => Math.max(1, Math.min(500, h + delta)));

  const add = (dishId: string, qty = 1) => {
    if (!dishMap[dishId]) return;
    setItems((prev) => {
      const existing = prev.find((i) => i.dishId === dishId);
      if (existing) return prev.map((i) => (i.dishId === dishId ? { ...i, qty: i.qty + qty } : i));
      return [...prev, { dishId, qty }];
    });
    setJustAdded((n) => n + 1);
  };

  const addBundle = (bundleId: string) => {
    const bundle = bundleMap[bundleId];
    if (!bundle) return;
    setItems((prev) => {
      const next = [...prev];
      for (const dishId of bundle.dishIds) {
        const existing = next.find((i) => i.dishId === dishId);
        if (existing) existing.qty += 1;
        else next.push({ dishId, qty: 1 });
      }
      return next;
    });
    setHeadcountState((h) => Math.max(h, bundle.serves));
    setJustAdded((n) => n + 1);
  };

  const remove = (dishId: string) => setItems((prev) => prev.filter((i) => i.dishId !== dishId));
  const setQty = (dishId: string, qty: number) =>
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.dishId !== dishId)
        : prev.map((i) => (i.dishId === dishId ? { ...i, qty } : i)),
    );
  const increment = (dishId: string) => add(dishId, 1);
  const decrement = (dishId: string) => setQty(dishId, (items.find((i) => i.dishId === dishId)?.qty ?? 0) - 1);
  const clear = () => setItems([]);
  const qtyOf = (dishId: string) => items.find((i) => i.dishId === dishId)?.qty ?? 0;

  const derived = useMemo(() => {
    const valid = items.filter((i) => dishMap[i.dishId]);

    const groupMap = new Map<string, GroupedRestaurant>();
    let subtotal = 0;
    let totalServings = 0;
    let itemCount = 0;

    for (const item of valid) {
      const dish = dishMap[item.dishId];
      const restaurant = restaurantMap[dish.restaurantId];
      const lineTotal = dish.price * item.qty;
      const lineServings = servesAvg(dish.serves) * item.qty;
      subtotal += lineTotal;
      totalServings += lineServings;
      itemCount += item.qty;

      if (!groupMap.has(restaurant.id)) {
        groupMap.set(restaurant.id, { restaurant, lines: [], subtotal: 0, servings: 0 });
      }
      const g = groupMap.get(restaurant.id)!;
      g.lines.push({ dish, qty: item.qty });
      g.subtotal += lineTotal;
      g.servings += lineServings;
    }

    const grouped = Array.from(groupMap.values());
    const restaurantIds = grouped.map((g) => g.restaurant.id);
    const deliveryFee = subtotal === 0 ? 0 : subtotal >= FREE_DELIVERY_OVER ? 0 : DELIVERY_FEE;
    const serviceFee = Math.round(subtotal * 0.07);
    const tax = Math.round(subtotal * 0.0875);
    const total = subtotal + deliveryFee + serviceFee + tax;
    const coverageRatio = headcount > 0 ? totalServings / headcount : 0;

    return {
      grouped,
      restaurantIds,
      restaurantCount: grouped.length,
      subtotal,
      deliveryFee,
      serviceFee,
      tax,
      total,
      perPerson: headcount > 0 ? total / headcount : 0,
      totalServings,
      coverageRatio,
      covered: coverageRatio >= 1,
      itemCount,
      distinctDishes: valid.length,
    };
  }, [items, headcount]);

  const value: CartValue = {
    hydrated,
    items,
    headcount,
    setHeadcount,
    bumpHeadcount,
    add,
    addBundle,
    remove,
    setQty,
    increment,
    decrement,
    clear,
    qtyOf,
    ...derived,
    isCartOpen,
    openCart: () => setCartOpen(true),
    closeCart: () => setCartOpen(false),
    toggleCart: () => setCartOpen((o) => !o),
    justAdded,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within <CartProvider>");
  return ctx;
}
