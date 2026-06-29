"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  CreditCard,
  Hand,
  Lock,
  MapPin,
  PartyPopper,
  ReceiptText,
  Sparkles,
  Truck,
  Users,
} from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { cuisineMap, dishMap, restaurantMap } from "@/lib/data";
import { placeOrder } from "@/lib/order-api";
import { cn, money } from "@/lib/utils";
import { Container } from "@/components/section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FoodImage } from "@/components/food-image";
import { HeadcountStepper } from "@/components/headcount-stepper";
import { Field, SelectInput, TextArea, TextInput, Toggle } from "./fields";
import { OrderSummary } from "./order-summary";

const STEPS = [
  { label: "Event details", short: "Event", Icon: CalendarDays },
  { label: "Delivery", short: "Delivery", Icon: Truck },
  { label: "Payment", short: "Payment", Icon: CreditCard },
  { label: "Review", short: "Review", Icon: ReceiptText },
];

const OCCASIONS = ["Team lunch", "Client meeting", "Celebration", "All-hands", "Other"];
const TIME_SLOTS = [
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "12:30 PM",
  "1:00 PM",
  "1:30 PM",
  "5:00 PM",
  "6:00 PM",
];

interface FormState {
  occasion: string;
  date: string;
  time: string;
  dietaryNotes: string;
  company: string;
  contact: string;
  email: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  zip: string;
  dropoff: string;
  contactless: boolean;
  payMethod: "card" | "invoice";
  cardNumber: string;
  expiry: string;
  cvc: string;
  cardName: string;
  billingZip: string;
}

const INITIAL: FormState = {
  occasion: "Team lunch",
  date: "",
  time: "12:00 PM",
  dietaryNotes: "",
  company: "",
  contact: "",
  email: "",
  phone: "",
  address1: "",
  address2: "",
  city: "",
  zip: "",
  dropoff: "",
  contactless: true,
  payMethod: "card",
  cardNumber: "",
  expiry: "",
  cvc: "",
  cardName: "",
  billingZip: "",
};

function cardBrand(number: string): { name: string; emoji: string } {
  const n = number.replace(/\s/g, "");
  if (/^4/.test(n)) return { name: "Visa", emoji: "💳" };
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return { name: "Mastercard", emoji: "💳" };
  if (/^3[47]/.test(n)) return { name: "Amex", emoji: "💳" };
  if (/^6/.test(n)) return { name: "Discover", emoji: "💳" };
  return { name: "Card", emoji: "💳" };
}

function formatCardNumber(v: string) {
  return v
    .replace(/[^\d]/g, "")
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function formatExpiry(v: string) {
  const d = v.replace(/[^\d]/g, "").slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

export function CheckoutFlow() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const cart = useCart();
  const { grouped, headcount, totalServings, total, perPerson, itemCount, restaurantCount, hydrated } =
    cart;

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [direction, setDirection] = useState(1);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  // Stable per-checkout key so an accidental double-submit is deduped server-side.
  const idemKey = useRef<string>("");
  if (!idemKey.current && typeof crypto !== "undefined") idemKey.current = crypto.randomUUID();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // default the date to ~5 days out (next weekday), client-side to avoid hydration mismatch.
  // deferred to the next frame so it never runs synchronously during the effect pass.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const d = new Date();
      d.setDate(d.getDate() + 5);
      while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate(),
      ).padStart(2, "0")}`;
      setForm((f) => (f.date ? f : { ...f, date: iso }));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const prettyDate = useMemo(() => {
    if (!form.date) return "Choose a date";
    const [y, m, day] = form.date.split("-").map(Number);
    const d = new Date(y, m - 1, day);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, [form.date]);

  const brand = cardBrand(form.cardNumber);

  const goNext = () => {
    setDirection(1);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };
  const goBack = () => {
    setDirection(-1);
    setStep((s) => Math.max(0, s - 1));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };
  const goTo = (i: number) => {
    if (i === step) return;
    setDirection(i > step ? 1 : -1);
    setStep(i);
  };

  const submitOrder = async () => {
    setPlaceError(null);
    setPlacing(true);
    try {
      const items = cart.items
        .filter((i) => dishMap[i.dishId])
        .map((i) => {
          const dish = dishMap[i.dishId];
          const restaurant = restaurantMap[dish.restaurantId];
          return {
            dishId: dish.id,
            restaurantId: dish.restaurantId,
            restaurantName: restaurant?.name,
            name: dish.name,
            qty: i.qty,
            unitPriceCents: Math.round(dish.price * 100),
            servesMin: dish.serves[0],
            servesMax: dish.serves[1],
            cuisine: dish.cuisine,
          };
        });

      if (items.length === 0) {
        setPlaceError("Your bundle is empty.");
        setPlacing(false);
        return;
      }

      const result = await placeOrder({
        idempotencyKey: idemKey.current || undefined,
        items,
        headcount,
        payMethod: form.payMethod,
        customerName: form.contact || undefined,
        customerEmail: form.email || undefined,
        customerPhone: form.phone || undefined,
        companyName: form.company || undefined,
        occasion: form.occasion,
        deliveryDate: form.date || undefined,
        deliveryTime: form.time || undefined,
        dietaryNotes: form.dietaryNotes || undefined,
        address1: form.address1 || undefined,
        address2: form.address2 || undefined,
        city: form.city || undefined,
        zip: form.zip || undefined,
        dropoffInstructions: form.dropoff || undefined,
        contactless: form.contactless,
      });

      cart.clear();
      router.push(`/order/${result.orderId}`);
    } catch (err) {
      setPlaceError(err instanceof Error ? err.message : "Could not place order. Please try again.");
      setPlacing(false);
    }
  };

  const slide = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, x: direction * 40 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: direction * -40 },
      };

  return (
    <div className="bg-radial-warm min-h-screen pb-24">
      {/* page header */}
      <header className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute -right-16 -top-10 h-56 w-56 rounded-full bg-accent/25 blur-3xl" />
        <Container className="relative py-10 sm:py-12">
          <Link
            href="/cart"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Back to bundle
          </Link>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Badge variant="glass" size="lg" className="mb-3 shadow-sm">
                <Lock className="h-3.5 w-3.5 text-primary" /> Secure checkout · demo
              </Badge>
              <h1 className="font-display text-4xl font-bold leading-[1.02] tracking-[-0.02em] text-foreground sm:text-5xl">
                Almost feast time.
              </h1>
              <p className="mt-2 max-w-md text-[1.0625rem] text-muted-foreground">
                A few details and your multi-restaurant spread is on the way.
              </p>
            </div>
            <div className="hidden items-center gap-2 rounded-full bg-white/70 px-4 py-2.5 ring-1 ring-border sm:flex">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Feeding {headcount}</span>
              <span className="text-muted-foreground">·</span>
              <span className="tnum text-sm font-bold text-foreground">{money(total)}</span>
            </div>
          </div>
        </Container>
      </header>

      <Container className="relative pt-8">
        <Stepper step={step} onJump={goTo} />

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1.55fr_1fr]">
          {/* ---------- left: step content ---------- */}
          <div className="rounded-[1.5rem] border border-border bg-surface p-6 shadow-soft sm:p-8">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                {...slide}
                transition={{ duration: reduce ? 0.15 : 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                {step === 0 && (
                  <StepShell
                    Icon={PartyPopper}
                    eyebrow="Step 1 of 4"
                    title="Event details"
                    subtitle="Tell us about the occasion so we can time everything to perfection."
                  >
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label="Occasion">
                        <SelectInput value={form.occasion} onChange={(e) => set("occasion", e.target.value)}>
                          {OCCASIONS.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </SelectInput>
                      </Field>
                      <Field label="Event date" hint={prettyDate !== "Choose a date" ? prettyDate : undefined}>
                        <TextInput
                          type="date"
                          value={form.date}
                          onChange={(e) => set("date", e.target.value)}
                        />
                      </Field>
                      <Field label="Delivery time">
                        <SelectInput value={form.time} onChange={(e) => set("time", e.target.value)}>
                          {TIME_SLOTS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </SelectInput>
                      </Field>
                      <Field label="Headcount" hint="sizes every dish">
                        <div className="flex h-12 items-center justify-between gap-3 rounded-[1rem] border border-border bg-white px-3">
                          <span className="text-sm font-semibold text-foreground">Guests</span>
                          <HeadcountStepper size="sm" />
                        </div>
                      </Field>
                    </div>
                    <Field label="Dietary notes" hint="optional" className="mt-5">
                      <TextArea
                        rows={3}
                        placeholder="e.g. 2 gluten-free, 1 nut allergy, label anything spicy…"
                        value={form.dietaryNotes}
                        onChange={(e) => set("dietaryNotes", e.target.value)}
                      />
                    </Field>
                  </StepShell>
                )}

                {step === 1 && (
                  <StepShell
                    Icon={Truck}
                    eyebrow="Step 2 of 4"
                    title="Delivery"
                    subtitle="Where should we bring this glorious spread?"
                  >
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label="Company name">
                        <TextInput
                          placeholder="Mastech Panel Systems"
                          value={form.company}
                          onChange={(e) => set("company", e.target.value)}
                          autoComplete="organization"
                        />
                      </Field>
                      <Field label="Contact name">
                        <TextInput
                          placeholder="Jack Rivera"
                          value={form.contact}
                          onChange={(e) => set("contact", e.target.value)}
                          autoComplete="name"
                        />
                      </Field>
                      <Field label="Email">
                        <TextInput
                          type="email"
                          placeholder="you@company.com"
                          value={form.email}
                          onChange={(e) => set("email", e.target.value)}
                          autoComplete="email"
                        />
                      </Field>
                      <Field label="Phone">
                        <TextInput
                          type="tel"
                          placeholder="(555) 012-3456"
                          value={form.phone}
                          onChange={(e) => set("phone", e.target.value)}
                          autoComplete="tel"
                        />
                      </Field>
                      <Field label="Address line 1" className="sm:col-span-2">
                        <TextInput
                          placeholder="500 Market Street, Floor 7"
                          value={form.address1}
                          onChange={(e) => set("address1", e.target.value)}
                          autoComplete="address-line1"
                        />
                      </Field>
                      <Field label="Address line 2" hint="optional" className="sm:col-span-2">
                        <TextInput
                          placeholder="Suite, unit, building"
                          value={form.address2}
                          onChange={(e) => set("address2", e.target.value)}
                          autoComplete="address-line2"
                        />
                      </Field>
                      <Field label="City">
                        <TextInput
                          placeholder="San Francisco"
                          value={form.city}
                          onChange={(e) => set("city", e.target.value)}
                          autoComplete="address-level2"
                        />
                      </Field>
                      <Field label="ZIP code">
                        <TextInput
                          inputMode="numeric"
                          placeholder="94105"
                          value={form.zip}
                          onChange={(e) => set("zip", e.target.value.replace(/[^\d-]/g, "").slice(0, 10))}
                          autoComplete="postal-code"
                        />
                      </Field>
                    </div>
                    <Field label="Drop-off instructions" hint="optional" className="mt-5">
                      <TextArea
                        rows={2}
                        placeholder="Check in at the front desk and ask for the office manager. Set up in the 7th-floor kitchen."
                        value={form.dropoff}
                        onChange={(e) => set("dropoff", e.target.value)}
                      />
                    </Field>
                    <div className="mt-5">
                      <Toggle
                        checked={form.contactless}
                        onChange={(v) => set("contactless", v)}
                        Icon={Hand}
                        label="Contactless drop-off"
                        description="Driver leaves everything at the entrance and texts on arrival."
                      />
                    </div>
                  </StepShell>
                )}

                {step === 2 && (
                  <StepShell
                    Icon={CreditCard}
                    eyebrow="Step 3 of 4"
                    title="Payment"
                    subtitle="No real charges — this is a demo checkout."
                  >
                    {/* method toggle */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <PayOption
                        active={form.payMethod === "card"}
                        onClick={() => set("payMethod", "card")}
                        Icon={CreditCard}
                        title="Pay by card"
                        subtitle="Charged when the order ships"
                      />
                      <PayOption
                        active={form.payMethod === "invoice"}
                        onClick={() => set("payMethod", "invoice")}
                        Icon={Building2}
                        title="Invoice my company"
                        subtitle="Net-30 billing to finance"
                      />
                    </div>

                    {form.payMethod === "card" ? (
                      <div className="mt-6">
                        {/* card flourish */}
                        <div className="relative overflow-hidden rounded-[1.25rem] bg-grape p-5 text-white shadow-lift">
                          <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
                          <div className="relative flex items-center justify-between">
                            <span className="grid h-9 w-12 place-items-center rounded-md bg-white/20 text-xl">
                              {brand.emoji}
                            </span>
                            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/85">
                              {brand.name}
                            </span>
                          </div>
                          <p className="tnum relative mt-6 font-display text-xl font-bold tracking-[0.08em]">
                            {form.cardNumber || "•••• •••• •••• ••••"}
                          </p>
                          <div className="relative mt-4 flex items-end justify-between text-xs">
                            <span className="font-medium uppercase tracking-wide text-white/85">
                              {form.cardName || "Name on card"}
                            </span>
                            <span className="tnum font-semibold text-white/85">
                              {form.expiry || "MM/YY"}
                            </span>
                          </div>
                        </div>

                        <div className="mt-6 grid gap-5 sm:grid-cols-2">
                          <Field label="Card number" className="sm:col-span-2">
                            <TextInput
                              inputMode="numeric"
                              placeholder="4242 4242 4242 4242"
                              value={form.cardNumber}
                              onChange={(e) => set("cardNumber", formatCardNumber(e.target.value))}
                              autoComplete="cc-number"
                            />
                          </Field>
                          <Field label="Expiry">
                            <TextInput
                              inputMode="numeric"
                              placeholder="MM/YY"
                              value={form.expiry}
                              onChange={(e) => set("expiry", formatExpiry(e.target.value))}
                              autoComplete="cc-exp"
                            />
                          </Field>
                          <Field label="CVC">
                            <TextInput
                              inputMode="numeric"
                              placeholder="123"
                              value={form.cvc}
                              onChange={(e) => set("cvc", e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
                              autoComplete="cc-csc"
                            />
                          </Field>
                          <Field label="Name on card">
                            <TextInput
                              placeholder="Jack Rivera"
                              value={form.cardName}
                              onChange={(e) => set("cardName", e.target.value)}
                              autoComplete="cc-name"
                            />
                          </Field>
                          <Field label="Billing ZIP">
                            <TextInput
                              inputMode="numeric"
                              placeholder="94105"
                              value={form.billingZip}
                              onChange={(e) =>
                                set("billingZip", e.target.value.replace(/[^\d-]/g, "").slice(0, 10))
                              }
                              autoComplete="cc-csc"
                            />
                          </Field>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-6 rounded-[1.25rem] border border-border bg-muted/50 p-6">
                        <div className="flex items-start gap-3">
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-secondary text-white">
                            <ReceiptText className="h-5 w-5" />
                          </span>
                          <div>
                            <p className="font-display text-base font-bold text-foreground">
                              We&apos;ll invoice {form.company || "your company"}
                            </p>
                            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                              A clean, itemized Net-30 invoice for {money(total)} goes straight to
                              finance — no chasing receipts from {restaurantCount}{" "}
                              {restaurantCount === 1 ? "vendor" : "vendors"}. We&apos;ll email a PO-ready
                              copy to {form.email || "your billing contact"}.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <p className="mt-5 flex items-center gap-2 rounded-2xl bg-muted px-4 py-3 text-xs text-muted-foreground">
                      <Lock className="h-4 w-4 shrink-0 text-success" />
                      Demo only — no card is processed and no money changes hands.
                    </p>
                  </StepShell>
                )}

                {step === 3 && (
                  <StepShell
                    Icon={Check}
                    eyebrow="Step 4 of 4"
                    title="Review & place order"
                    subtitle="One last look before the trays roll out."
                  >
                    <div className="space-y-4">
                      <ReviewBlock
                        Icon={CalendarDays}
                        title="Event"
                        onEdit={() => goTo(0)}
                        rows={[
                          [form.occasion, prettyDate],
                          [`${form.time} delivery`, `Feeding ${headcount} guests`],
                          form.dietaryNotes ? ["Dietary notes", form.dietaryNotes] : null,
                        ]}
                      />
                      <ReviewBlock
                        Icon={MapPin}
                        title="Delivery"
                        onEdit={() => goTo(1)}
                        rows={[
                          [form.company || "—", form.contact || "—"],
                          [
                            form.address1 || "Address pending",
                            [form.city, form.zip].filter(Boolean).join(" ") || "",
                          ],
                          [
                            form.email || "—",
                            form.contactless ? "Contactless drop-off" : "Hand-off in person",
                          ],
                        ]}
                      />
                      <ReviewBlock
                        Icon={form.payMethod === "card" ? CreditCard : Building2}
                        title="Payment"
                        onEdit={() => goTo(2)}
                        rows={[
                          form.payMethod === "card"
                            ? [
                                `${brand.name} ${form.cardNumber ? `ending ${form.cardNumber.replace(/\s/g, "").slice(-4)}` : "card"}`,
                                form.expiry ? `Exp ${form.expiry}` : "Demo card",
                              ]
                            : ["Company invoice", "Net-30 billing"],
                        ]}
                      />

                      {/* the bundle */}
                      <div className="rounded-[1.25rem] border border-border bg-muted/40 p-5">
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
                            <Sparkles className="h-4 w-4 text-primary" /> Your bundle
                          </h3>
                          <Link
                            href="/cart"
                            className="text-xs font-semibold text-primary transition hover:text-primary-bright"
                          >
                            Edit
                          </Link>
                        </div>
                        <div className="space-y-4">
                          {grouped.map((g) => (
                            <div key={g.restaurant.id}>
                              <div className="mb-2 flex items-center gap-2">
                                <span
                                  style={{ backgroundColor: g.restaurant.logoColor }}
                                  className="grid h-5 w-5 place-items-center rounded-full text-[0.6rem] font-bold text-white"
                                >
                                  {g.restaurant.name.charAt(0)}
                                </span>
                                <span className="font-display text-[0.8125rem] font-bold text-foreground">
                                  {g.restaurant.name}
                                </span>
                                <Badge variant="neutral" size="sm" className="ml-auto">
                                  {cuisineMap[g.restaurant.cuisine].emoji}{" "}
                                  {cuisineMap[g.restaurant.cuisine].label}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {g.lines.map(({ dish, qty }) => (
                                  <div
                                    key={dish.id}
                                    className="flex items-center gap-2 rounded-full border border-border bg-white py-1 pl-1 pr-3"
                                  >
                                    <span className="relative h-8 w-8 overflow-hidden rounded-full">
                                      <FoodImage
                                        src={dish.image}
                                        alt={dish.name}
                                        emoji={cuisineMap[dish.cuisine].emoji}
                                        sizes="32px"
                                      />
                                    </span>
                                    <span className="text-xs font-semibold text-foreground">
                                      {dish.name}
                                    </span>
                                    {qty > 1 && (
                                      <span className="tnum text-[0.6875rem] font-bold text-primary">
                                        ×{qty}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                          <span className="text-sm text-muted-foreground">
                            {itemCount} {itemCount === 1 ? "tray" : "trays"} · feeds ~
                            {Math.round(totalServings)}
                          </span>
                          <span className="text-right">
                            <span className="tnum block font-display text-xl font-bold text-foreground">
                              {money(total)}
                            </span>
                            <span className="tnum block text-xs text-muted-foreground">
                              {money(perPerson, true)} / guest
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="hero"
                      size="lg"
                      className="mt-6 w-full"
                      onClick={submitOrder}
                      disabled={placing || (hydrated && itemCount === 0)}
                    >
                      {placing ? (
                        <>
                          <Sparkles className="h-5 w-5 animate-pulse" /> Placing order…
                        </>
                      ) : (
                        <>
                          Place order · {money(total)} <ArrowRight className="h-5 w-5" />
                        </>
                      )}
                    </Button>
                    {placeError && (
                      <p className="mt-3 rounded-xl bg-[#fde8e8] px-4 py-2.5 text-center text-sm font-medium text-[#b42318]">
                        {placeError}
                      </p>
                    )}
                    <p className="mt-3 text-center text-xs text-muted-foreground">
                      Your order is placed through the live pipeline — each kitchen is sent its order and a
                      courier is dispatched. Track it in real time on the next screen.
                    </p>
                  </StepShell>
                )}
              </motion.div>
            </AnimatePresence>

            {/* nav buttons (hidden on review — review has its own CTA) */}
            {step < STEPS.length - 1 && (
              <div className="mt-8 flex items-center justify-between gap-4 border-t border-border pt-6">
                {step > 0 ? (
                  <Button type="button" variant="outline" onClick={goBack}>
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                ) : (
                  <Link href="/cart">
                    <Button type="button" variant="ghost">
                      <ArrowLeft className="h-4 w-4" /> Bundle
                    </Button>
                  </Link>
                )}
                <Button type="button" variant="primary" onClick={goNext}>
                  Continue <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
            {step === STEPS.length - 1 && (
              <div className="mt-8 border-t border-border pt-6">
                <Button type="button" variant="outline" onClick={goBack}>
                  <ArrowLeft className="h-4 w-4" /> Back to payment
                </Button>
              </div>
            )}
          </div>

          {/* ---------- right: sticky summary ---------- */}
          <div className="lg:sticky lg:top-24">
            <OrderSummary />
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5 text-success" />
              One delivery · one invoice · {restaurantCount}{" "}
              {restaurantCount === 1 ? "kitchen" : "kitchens"}
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}

/* ----------------------------- sub-components ----------------------------- */

function Stepper({ step, onJump }: { step: number; onJump: (i: number) => void }) {
  return (
    <ol className="flex items-center gap-2 sm:gap-3">
      {STEPS.map((s, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <li key={s.label} className="flex flex-1 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => onJump(i)}
              className="group flex min-w-0 items-center gap-2.5 text-left"
            >
              <span
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold transition-all sm:h-10 sm:w-10",
                  done && "bg-sunset text-white shadow-[0_6px_16px_-6px_rgba(232,67,31,0.6)]",
                  active &&
                    "bg-primary text-white shadow-[0_8px_20px_-6px_rgba(232,67,31,0.55)] ring-4 ring-primary-bright/15",
                  !done && !active && "border border-border bg-white text-muted-foreground group-hover:border-primary/40",
                )}
              >
                {done ? <Check className="h-4 w-4" /> : <s.Icon className="h-4 w-4" />}
              </span>
              <span className="hidden min-w-0 flex-col sm:flex">
                <span className="text-[0.625rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Step {i + 1}
                </span>
                <span
                  className={cn(
                    "truncate text-sm font-semibold transition-colors",
                    active || done ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </span>
              </span>
              <span
                className={cn(
                  "text-xs font-semibold sm:hidden",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {s.short}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-border">
                <motion.span
                  initial={false}
                  animate={{ width: done ? "100%" : "0%" }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="bg-sunset absolute inset-y-0 left-0 rounded-full"
                />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function StepShell({
  Icon,
  eyebrow,
  title,
  subtitle,
  children,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-6 flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-muted text-primary">
          <Icon className="h-6 w-6" />
        </span>
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-primary">{eyebrow}</span>
          <h2 className="font-display text-2xl font-bold leading-tight tracking-[-0.01em] text-foreground">
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function PayOption({
  active,
  onClick,
  Icon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-3 rounded-[1.25rem] border bg-white p-4 text-left transition",
        active ? "border-primary ring-2 ring-primary/15" : "border-border hover:border-primary/40",
      )}
    >
      <span
        className={cn(
          "grid h-11 w-11 shrink-0 place-items-center rounded-full transition",
          active ? "bg-primary text-white" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <span
        className={cn(
          "ml-auto grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition",
          active ? "border-primary bg-primary" : "border-border",
        )}
      >
        {active && <Check className="h-3 w-3 text-white" />}
      </span>
    </button>
  );
}

function ReviewBlock({
  Icon,
  title,
  onEdit,
  rows,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  onEdit: () => void;
  rows: ([string, string] | null)[];
}) {
  const visible = rows.filter((r): r is [string, string] => r !== null && Boolean(r[0]));
  return (
    <div className="rounded-[1.25rem] border border-border bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </h3>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs font-semibold text-primary transition hover:text-primary-bright"
        >
          Edit
        </button>
      </div>
      <dl className="space-y-1.5">
        {visible.map(([a, b], i) => (
          <div key={i} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
            <dt className="text-sm font-semibold text-foreground">{a}</dt>
            {b && <dd className="text-sm text-muted-foreground">{b}</dd>}
          </div>
        ))}
      </dl>
    </div>
  );
}
