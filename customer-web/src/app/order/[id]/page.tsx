import { notFound } from "next/navigation";
import type { OrderView } from "@/lib/order-api";
import { composeCartView } from "@/lib/dr";
import { OrderTracker } from "./order-tracker";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await composeCartView(id);
  // order is null only when the cart token itself is unreadable. A not-yet-seeded
  // order comes back as a pending view, so we render the tracker and let SSE fill in.
  if (!view.order) notFound();
  const initial = JSON.parse(JSON.stringify(view)) as OrderView;
  return <OrderTracker orderId={id} initial={initial} />;
}
