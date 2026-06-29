/**
 * Dinner Rush adapter. This storefront owns no database. It talks to the same
 * front door (ingestion-svc) and read API (orchestrator-svc) that every other
 * part of the dinner-rush stack uses, so a customer order flows through the
 * exact same outbox + idempotency path as load-generated traffic.
 *
 * One catering cart spans several restaurants, but a dinner-rush order is
 * single-restaurant. So checkout fans a cart out into one order per restaurant
 * and returns a stateless "cart token" (base64url of the order ids + headcount).
 * The tracker decodes the token, reads each order back from the orchestrator,
 * and composes a single aggregate view: one fulfillment + one delivery row per
 * restaurant, and an overall status that is the least-advanced of the lot.
 */
import { restaurantMap } from "./data";
import type {
  DeliveryRow,
  FulfillmentRow,
  ItemRow,
  OrderRow,
  OrderView,
  PlaceOrderInput,
  PlaceOrderResult,
  TransitionRow,
} from "./order-api";

const INGESTION_URL = process.env.INGESTION_URL ?? "http://localhost:8001";
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL ?? "http://localhost:8002";

// Lifecycle order, least to most advanced. Mirrors orchestrator-svc.
const FLOW = ["placed", "confirmed", "preparing", "ready", "out_for_delivery", "delivered"] as const;

// ---- cart token -------------------------------------------------------------
// Immutable facts only: the per-restaurant order ids + the restaurant they hit,
// plus headcount. Everything live (status, totals, timeline) is read back from
// the orchestrator, never trusted from the token.

interface CartToken {
  v: 1;
  hc: number;
  o: { id: string; r: string }[];
}

export function encodeCart(token: CartToken): string {
  return Buffer.from(JSON.stringify(token)).toString("base64url");
}

export function decodeCart(token: string): CartToken | null {
  try {
    const parsed = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
    if (parsed && parsed.v === 1 && Array.isArray(parsed.o)) return parsed as CartToken;
    return null;
  } catch {
    return null;
  }
}

// ---- place: cart -> N ingestion POSTs --------------------------------------

interface IngestItem {
  name: string;
  qty: number;
  price_cents: number;
}

export async function placeCart(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const cartKey =
    input.idempotencyKey ?? (globalThis.crypto?.randomUUID?.() ?? `cart-${Date.now()}`);
  const customerId = input.customerName?.trim() || input.customerEmail?.trim() || "guest";

  // group cart lines by restaurant
  const byRestaurant = new Map<string, IngestItem[]>();
  for (const it of input.items) {
    const list = byRestaurant.get(it.restaurantId) ?? [];
    list.push({ name: it.name ?? it.dishId, qty: it.qty, price_cents: it.unitPriceCents });
    byRestaurant.set(it.restaurantId, list);
  }
  if (byRestaurant.size === 0) throw new Error("cart is empty");

  const placed: { id: string; r: string }[] = [];
  let totalCents = 0;

  // One order per restaurant. A per-restaurant idempotency key keeps a retried
  // checkout from creating duplicate orders for any restaurant.
  await Promise.all(
    [...byRestaurant.entries()].map(async ([restaurantId, items]) => {
      const res = await fetch(`${INGESTION_URL}/orders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customer_id: customerId,
          restaurant_id: restaurantId,
          items,
          idempotency_key: `${cartKey}:${restaurantId}`,
        }),
      });
      if (res.status !== 200 && res.status !== 202) {
        throw new Error(`ingestion rejected ${restaurantId} (HTTP ${res.status})`);
      }
      const body = (await res.json()) as { order_id: string };
      placed.push({ id: body.order_id, r: restaurantId });
      totalCents += items.reduce((s, i) => s + i.qty * i.price_cents, 0);
    }),
  );

  // stable order so the token is deterministic for a given cart
  placed.sort((a, b) => a.r.localeCompare(b.r));

  return {
    orderId: encodeCart({ v: 1, hc: input.headcount, o: placed }),
    status: "accepted",
    idempotencyKey: cartKey,
    duplicate: false,
    totalCents,
  };
}

// ---- read: orchestrator rows -> aggregate OrderView -------------------------

interface OrchOrder {
  order_id: string;
  state: string;
  customer_id: string | null;
  restaurant_id: string | null;
  items: { name: string; qty: number; price_cents: number }[];
  total_cents: number;
  created_at: string;
}

interface OrchTransition {
  from_state: string | null;
  to_state: string;
  cause: string | null;
  attempt: number;
  created_at: string;
}

interface OrchView {
  order: OrchOrder;
  transitions: OrchTransition[];
}

// Pending placeholder for the brief window after ingestion accepts an order but
// before the outbox relay has seeded it into the orchestrator. The token still
// tells us which restaurant it is, so the tracker stays labeled.
function pending(id: string, restaurantId: string): OrchView {
  return {
    order: {
      order_id: id,
      state: "placed",
      customer_id: null,
      restaurant_id: restaurantId,
      items: [],
      total_cents: 0,
      created_at: new Date().toISOString(),
    },
    transitions: [],
  };
}

async function fetchOrder(id: string, restaurantId: string): Promise<OrchView> {
  try {
    const res = await fetch(`${ORCHESTRATOR_URL}/orders/${id}`, { cache: "no-store" });
    if (res.status === 404) return pending(id, restaurantId);
    if (!res.ok) return pending(id, restaurantId);
    return (await res.json()) as OrchView;
  } catch {
    return pending(id, restaurantId);
  }
}

const flowIdx = (s: string) => {
  const i = FLOW.indexOf(s as (typeof FLOW)[number]);
  return i === -1 ? 0 : i;
};

function aggregateStatus(states: string[]): OrderRow["status"] {
  if (states.some((s) => s === "failed")) return "failed";
  const active = states.filter((s) => s !== "cancelled");
  if (active.length === 0) return "cancelled";
  const min = active.reduce((m, s) => Math.min(m, flowIdx(s)), FLOW.length - 1);
  return FLOW[min];
}

const KITCHEN_FROM_STATE: Record<string, FulfillmentRow["status"]> = {
  placed: "pending",
  confirmed: "placed",
  preparing: "preparing",
  ready: "ready",
  out_for_delivery: "ready",
  delivered: "ready",
  failed: "failed",
  cancelled: "cancelled",
};

const DELIVERY_FROM_STATE: Record<string, DeliveryRow["status"]> = {
  placed: "pending",
  confirmed: "pending",
  preparing: "pending",
  ready: "created",
  out_for_delivery: "picked_up",
  delivered: "delivered",
  failed: "failed",
  cancelled: "cancelled",
};

const restaurantName = (id: string | null) => (id ? restaurantMap[id]?.name ?? id : null);
const restaurantCuisine = (id: string | null) => (id ? restaurantMap[id]?.cuisine ?? null : null);

// Same shape as OrderView, but order may be null when the token is unreadable.
type CartView = Omit<OrderView, "order"> & { order: OrderRow | null };

/** Compose the live aggregate view for a cart token. Returns order: null only
 *  when the token itself is unreadable; a not-yet-seeded order is shown pending,
 *  never 404, so the tracker survives the outbox relay lag. */
export async function composeCartView(token: string): Promise<CartView> {
  const decoded = decodeCart(token);
  if (!decoded) {
    return { order: null, items: [], fulfillments: [], deliveries: [], transitions: [] };
  }

  const views = await Promise.all(decoded.o.map((o) => fetchOrder(o.id, o.r)));

  const items: ItemRow[] = [];
  const fulfillments: FulfillmentRow[] = [];
  const deliveries: DeliveryRow[] = [];
  let totalCents = 0;
  let createdAt = "";
  let failureReason: string | null = null;

  for (const { order, transitions } of views) {
    const rid = order.restaurant_id;
    totalCents += order.total_cents;
    if (!createdAt || order.created_at < createdAt) createdAt = order.created_at;

    order.items.forEach((it, idx) =>
      items.push({
        id: `${order.order_id}-${idx}`,
        restaurantId: rid ?? "",
        restaurantName: restaurantName(rid),
        dishId: "",
        name: it.name,
        qty: it.qty,
        unitPriceCents: it.price_cents,
        cuisine: restaurantCuisine(rid),
      }),
    );

    fulfillments.push({
      id: order.order_id,
      restaurantId: rid ?? "",
      restaurantName: restaurantName(rid),
      provider: "kitchen",
      providerOrderId: order.order_id.slice(0, 8),
      status: KITCHEN_FROM_STATE[order.state] ?? "pending",
      subtotalCents: order.total_cents,
    });

    deliveries.push({
      id: `${order.order_id}-d`,
      restaurantId: rid,
      provider: "courier",
      providerDeliveryId: order.state === "placed" ? null : order.order_id.slice(0, 8),
      status: DELIVERY_FROM_STATE[order.state] ?? "pending",
      trackingUrl: null,
      feeCents: 0,
    });

    if (order.state === "failed") {
      const cause = transitions.find((t) => t.to_state === "failed")?.cause;
      if (cause) failureReason = cause;
    }
  }

  const states = views.map((v) => v.order.state);
  const status = aggregateStatus(states);
  const firstCustomer = views.find((v) => v.order.customer_id)?.order.customer_id ?? null;

  // merged timeline (kept for completeness; the stepper derives from status)
  const transitions: TransitionRow[] = views
    .flatMap((v) => v.transitions)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((t, i) => ({
      id: i + 1,
      fromState: t.from_state,
      toState: t.to_state,
      cause: t.cause,
      attempt: t.attempt,
      createdAt: t.created_at,
    }));

  const order: OrderRow = {
    id: token,
    status,
    headcount: decoded.hc,
    customerName: firstCustomer === "guest" ? null : firstCustomer,
    customerEmail: null,
    companyName: null,
    occasion: null,
    deliveryDate: null,
    deliveryTime: null,
    address1: null,
    city: null,
    zip: null,
    currency: "usd",
    subtotalCents: totalCents,
    deliveryFeeCents: 0,
    serviceFeeCents: 0,
    taxCents: 0,
    tipCents: 0,
    totalCents,
    failureReason,
    createdAt: createdAt || new Date().toISOString(),
  };

  return { order, items, fulfillments, deliveries, transitions };
}
