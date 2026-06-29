/**
 * POST /api/orders - the storefront front door. Validates the cart, then hands
 * it to the dinner-rush adapter, which fans it out into one order per restaurant
 * through ingestion-svc. Returns 202 with a cart token the tracker reads back.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { placeCart } from "@/lib/dr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ItemSchema = z.object({
  dishId: z.string().min(1),
  restaurantId: z.string().min(1),
  restaurantName: z.string().optional(),
  name: z.string().optional(),
  qty: z.number().int().positive(),
  unitPriceCents: z.number().int().nonnegative(),
  servesMin: z.number().int().optional(),
  servesMax: z.number().int().optional(),
  cuisine: z.string().optional(),
});

const OrderSchema = z.object({
  idempotencyKey: z.string().min(1).optional(),
  items: z.array(ItemSchema).min(1),
  headcount: z.number().int().positive().max(2000).default(1),
  payMethod: z.enum(["card", "invoice"]).optional(),
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional().or(z.literal("")),
  customerPhone: z.string().optional(),
  companyName: z.string().optional(),
  occasion: z.string().optional(),
  deliveryDate: z.string().optional(),
  deliveryTime: z.string().optional(),
  dietaryNotes: z.string().optional(),
  address1: z.string().optional(),
  address2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  dropoffInstructions: z.string().optional(),
  contactless: z.boolean().optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = OrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid order", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const result = await placeCart(parsed.data);
    return NextResponse.json(result, { status: 202 });
  } catch (err) {
    return NextResponse.json(
      { error: "could not place order", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
