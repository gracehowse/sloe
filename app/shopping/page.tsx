/**
 * /shopping — canonical Shopping List render path.
 * See `app/today/page.tsx` for the routing rationale.
 */
import type { Metadata } from "next";
import { HomePageClient } from "../HomePageClient";

export const metadata: Metadata = {
  title: "Shopping — Suppr",
  description: "Your shopping list from this week's plan.",
};

export default function ShoppingPage() {
  return <HomePageClient />;
}
