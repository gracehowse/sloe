/**
 * /plan — canonical Meal Plan render path.
 * See `app/today/page.tsx` for the routing rationale.
 */
import type { Metadata } from "next";
import { HomePageClient } from "../HomePageClient";

export const metadata: Metadata = {
  title: "Plan — Suppr",
  description: "Your meal plan and shopping list.",
};

export default function PlanPage() {
  return <HomePageClient />;
}
