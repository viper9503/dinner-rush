"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  ChefHat,
  Clock,
  ExternalLink,
  PackageCheck,
  PartyPopper,
  Receipt,
  Truck,
  Users,
} from "lucide-react";
import type { FulfillmentRow, OrderView } from "@/lib/order-api";
import { restaurantMap } from "@/lib/data";
import { cn, money } from "@/lib/utils";
import { Container } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const FLOW = ["placed", "confirmed", "preparing", "ready", "out_for_delivery", "delivered"];

const STEPS = [
  { atOrAfter: "placed", title: "Order received & paid", sub: "Payment authorized", Icon: Check },
  { atOrAfter: "preparing", title: "Kitchens preparing", sub: "Sent to every restaurant", Icon: ChefHat },
  { atOrAfter: "ready", title: "Ready for pickup", sub: "Trays packed & labeled", Icon: PackageCheck },
  { atOrAfter: "out_for_delivery", title: "Out for delivery", sub: "Couriers dispatched", Icon: Truck },
  { atOrAfter: "delivered", title: "Delivered", sub: "Enjoy the feast", Icon: PartyPopper },
];

function useOrderStream(orderId: string, initial: OrderView): OrderView {
  const [view, setView] = useState<OrderView>(initial);
  useEffect(() => {
    const es = new EventSource(`/api/orders/${orderId}/stream`);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data && data.order) setView(data);
      } catch {
        /* ignore malformed frame */
      }
    };
    return () => es.close();
  }, [orderId]);
  return view;
}

const KITCHEN_PILL: Record<FulfillmentRow["status"], { label: string; cls: string }> = {
  pending: { label: "Queued", cls: "bg-muted text-muted-foreground" },
  placed: { label: "Order placed", cls: "bg-[#fff2d1] text-[#8a5a07]" },
  preparing: { label: "Preparing", cls: "bg-[#fff2d1] text-[#8a5a07]" },
  ready: { label: "Ready", cls: "bg-white text-success ring-1 ring-inset ring-success/25" },
  failed: { label: "Failed", cls: "bg-[#fde8e8] text-[#b42318]" },
  cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground" },
};

export function OrderTracker({ orderId, initial }: { orderId: string; initial: OrderView }) {
  const view = useOrderStream(orderId, initial);
  const { order, fulfillments, deliveries } = view;

  const currentIdx = Math.max(0, FLOW.indexOf(order.status));
  const failed = order.status === "failed" || order.status === "cancelled";
  const activeStep = STEPS.reduce(
    (acc, s, i) => (currentIdx >= FLOW.indexOf(s.atOrAfter) ? i : acc),
    0,
  );
  const restaurantCount = fulfillments.length;
  const c = (cents: number) => money(cents / 100);

  return (
    <>
      {/* hero */}
      <section className="bg-radial-warm relative overflow-hidden">
        <div className="pointer-events-none absolute -left-28 top-8 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
        <Container className="relative py-14 text-center sm:py-16">
          <div
            className={cn(
              "mx-auto grid h-20 w-20 place-items-center rounded-full text-white shadow-lift",
              failed ? "bg-[#b42318]" : order.status === "delivered" ? "bg-success" : "bg-sunset",
            )}
          >
            {failed ? (
              <AlertTriangle className="h-9 w-9" />
            ) : order.status === "delivered" ? (
              <Check className="h-10 w-10" strokeWidth={3} />
            ) : (
              <ChefHat className="h-9 w-9" />
            )}
          </div>
          <Badge variant="glass" size="lg" className="mt-6 shadow-sm">
            <Receipt className="h-3.5 w-3.5 text-primary" /> Order #{order.id.slice(0, 8).toUpperCase()}
          </Badge>
          <h1 className="mx-auto mt-4 max-w-3xl font-display text-[clamp(2rem,5vw,3.25rem)] font-bold leading-[1.03] tracking-[-0.03em] text-foreground">
            {failed
              ? "We hit a snag"
              : order.status === "delivered"
                ? "Delivered — enjoy!"
                : "Your bundle is in motion"}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-lg text-muted-foreground">
            {failed
              ? order.failureReason ?? "This order could not be completed."
              : `${restaurantCount} ${restaurantCount === 1 ? "kitchen" : "kitchens"} · feeding ${order.headcount} · one coordinated delivery.`}
          </p>
          <div className="mx-auto mt-7 flex max-w-2xl flex-wrap items-center justify-center gap-3">
            <Fact Icon={Clock} label="Status" value={pretty(order.status)} />
            <Fact Icon={Users} label="Feeding" value={`${order.headcount} guests`} />
            <Fact Icon={Receipt} label="Total" value={c(order.totalCents)} />
          </div>
        </Container>
      </section>

      {/* live tracker */}
      <section className="py-12 sm:py-14">
        <Container>
          <div className="relative overflow-hidden rounded-[1.5rem] border border-border bg-surface p-6 shadow-lift sm:p-9">
            <span className="bg-sunset absolute inset-x-10 -top-px h-1 rounded-full" />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Live tracker</p>
                <h2 className="mt-1 font-display text-2xl font-bold tracking-[-0.02em] text-foreground">
                  Right now: {pretty(order.status)}
                </h2>
              </div>
              {!failed && (
                <Badge variant="sunset" size="lg" className="shadow-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                  </span>
                  Live
                </Badge>
              )}
            </div>

            <ol className="mt-8 flex flex-col gap-0 md:flex-row">
              {STEPS.map((step, i) => {
                const done = i < activeStep || order.status === "delivered";
                const active = i === activeStep && !failed && order.status !== "delivered";
                const reached = done || active;
                const last = i === STEPS.length - 1;
                return (
                  <li key={step.atOrAfter} className="relative flex flex-1 gap-4 pb-8 md:flex-col md:pb-0">
                    {!last && (
                      <span
                        className={cn(
                          "absolute left-[1.4rem] top-12 h-[calc(100%-3rem)] w-0.5 md:left-auto md:right-0 md:top-[1.4rem] md:h-0.5 md:w-[calc(100%-3rem)]",
                          done ? "bg-sunset" : "bg-border",
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        "relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-full ring-4 ring-surface",
                        reached ? "bg-sunset text-white" : "bg-muted text-muted-foreground",
                        active && "animate-pulse",
                      )}
                    >
                      <step.Icon className="h-5 w-5" strokeWidth={2.4} />
                    </span>
                    <div className="md:mt-4">
                      <div className="flex items-center gap-2">
                        <h3 className={cn("font-display text-base font-bold", reached ? "text-foreground" : "text-muted-foreground")}>
                          {step.title}
                        </h3>
                        {done && <Check className="h-4 w-4 text-success" strokeWidth={3} />}
                        {active && <Badge variant="deal" size="sm">Now</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{step.sub}</p>
                    </div>
                  </li>
                );
              })}
            </ol>

            {/* per-kitchen status */}
            <div className="mt-8 border-t border-border pt-6">
              <h3 className="mb-4 font-display text-sm font-bold text-foreground">Kitchen status</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {fulfillments.map((f) => {
                  const r = restaurantMap[f.restaurantId];
                  const pill = KITCHEN_PILL[f.status];
                  return (
                    <div key={f.id} className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 p-3">
                      <span
                        style={{ backgroundColor: r?.logoColor ?? "#e8431f" }}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                      >
                        {(f.restaurantName ?? f.restaurantId).charAt(0)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{f.restaurantName ?? f.restaurantId}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {f.providerOrderId ? `#${f.providerOrderId.slice(-8)}` : "awaiting POS"}
                        </p>
                      </div>
                      <span className={cn("inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold", pill.cls)}>
                        {pill.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* deliveries */}
            {deliveries.length > 0 && (
              <div className="mt-6 border-t border-border pt-6">
                <h3 className="mb-4 font-display text-sm font-bold text-foreground">Delivery</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {deliveries.map((d) => (
                    <div key={d.id} className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 p-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-white">
                        <Truck className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {restaurantMap[d.restaurantId ?? ""]?.name ?? "Pickup"} · {pretty(d.status)}
                        </p>
                        {d.trackingUrl && (
                          <a href={d.trackingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                            Track <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      {typeof d.feeCents === "number" && (
                        <span className="tnum shrink-0 text-xs text-muted-foreground">{c(d.feeCents)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* totals */}
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
            <div />
            <aside className="rounded-[1.25rem] border border-border bg-surface p-6 shadow-soft">
              <h3 className="font-display text-lg font-bold text-foreground">Invoice</h3>
              <dl className="mt-4 space-y-1.5 text-sm">
                <Row label="Subtotal" value={c(order.subtotalCents)} />
                <Row label="Delivery" value={order.deliveryFeeCents === 0 ? "FREE" : c(order.deliveryFeeCents)} />
                <Row label="Service" value={c(order.serviceFeeCents)} />
                <Row label="Tax" value={c(order.taxCents)} />
                {order.tipCents > 0 && <Row label="Tip" value={c(order.tipCents)} />}
                <div className="mt-2 flex items-center justify-between border-t border-border pt-2.5">
                  <span className="font-display text-base font-bold text-foreground">Total</span>
                  <span className="tnum font-display text-xl font-bold text-foreground">{c(order.totalCents)}</span>
                </div>
              </dl>
              <Link href="/restaurants" className="mt-5 block">
                <Button variant="outline" size="lg" className="w-full">Order again</Button>
              </Link>
            </aside>
          </div>
        </Container>
      </section>
    </>
  );
}

function pretty(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function Fact({ Icon, label, value }: { Icon: typeof Receipt; label: string; value: string }) {
  return (
    <div className="flex min-w-[9rem] flex-1 items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-left shadow-soft">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
        <span className="tnum block truncate font-display text-sm font-bold text-foreground">{value}</span>
      </span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tnum font-medium text-foreground">{value}</dd>
    </div>
  );
}
