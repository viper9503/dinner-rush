import type { Metadata } from "next";
import { CheckoutFlow } from "./checkout-flow";

export const metadata: Metadata = {
  title: "Checkout — Dinner Rush",
  description:
    "Place your multi-restaurant catering bundle. Event details, delivery, payment and review — one delivery, one invoice.",
};

export default function CheckoutPage() {
  return <CheckoutFlow />;
}
