import type { Metadata } from "next";
import { CartView } from "./cart-view";

export const metadata: Metadata = {
  title: "Your bundle — Dinner Rush",
  description:
    "Review your multi-restaurant catering bundle, size it to your headcount, and check out with one delivery and one invoice.",
};

export default function CartPage() {
  return <CartView />;
}
