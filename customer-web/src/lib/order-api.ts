/**
 * Client-side helpers + JSON types for the real order pipeline. Mirrors the
 * server read model (dates arrive as ISO strings over JSON / SSE).
 */

export interface OrderRow {
  id: string;
  status:
    | "placed"
    | "confirmed"
    | "preparing"
    | "ready"
    | "out_for_delivery"
    | "delivered"
    | "cancelled"
    | "failed";
  headcount: number;
  customerName: string | null;
  customerEmail: string | null;
  companyName: string | null;
  occasion: string | null;
  deliveryDate: string | null;
  deliveryTime: string | null;
  address1: string | null;
  city: string | null;
  zip: string | null;
  currency: string;
  subtotalCents: number;
  deliveryFeeCents: number;
  serviceFeeCents: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
  failureReason: string | null;
  createdAt: string;
}

export interface ItemRow {
  id: string;
  restaurantId: string;
  restaurantName: string | null;
  dishId: string;
  name: string | null;
  qty: number;
  unitPriceCents: number;
  cuisine: string | null;
}

export interface FulfillmentRow {
  id: string;
  restaurantId: string;
  restaurantName: string | null;
  provider: string;
  providerOrderId: string | null;
  status: "pending" | "placed" | "preparing" | "ready" | "failed" | "cancelled";
  subtotalCents: number;
}

export interface DeliveryRow {
  id: string;
  restaurantId: string | null;
  provider: string;
  providerDeliveryId: string | null;
  status: "pending" | "created" | "scheduled" | "picked_up" | "delivered" | "failed" | "cancelled";
  trackingUrl: string | null;
  feeCents: number | null;
}

export interface TransitionRow {
  id: number;
  fromState: string | null;
  toState: string;
  cause: string | null;
  attempt: number;
  createdAt: string;
}

export interface OrderView {
  order: OrderRow;
  items: ItemRow[];
  fulfillments: FulfillmentRow[];
  deliveries: DeliveryRow[];
  transitions: TransitionRow[];
}

export interface PlaceOrderItem {
  dishId: string;
  restaurantId: string;
  restaurantName?: string;
  name?: string;
  qty: number;
  unitPriceCents: number;
  servesMin?: number;
  servesMax?: number;
  cuisine?: string;
}

export interface PlaceOrderInput {
  idempotencyKey?: string;
  items: PlaceOrderItem[];
  headcount: number;
  tipCents?: number;
  payMethod?: "card" | "invoice";
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  companyName?: string;
  occasion?: string;
  deliveryDate?: string;
  deliveryTime?: string;
  dietaryNotes?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  dropoffInstructions?: string;
  contactless?: boolean;
}

export interface PlaceOrderResult {
  orderId: string;
  status: string;
  idempotencyKey: string;
  duplicate: boolean;
  totalCents: number;
}

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const res = await fetch("/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (res.status !== 200 && res.status !== 202) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? `Could not place order (HTTP ${res.status})`);
  }
  return res.json();
}
