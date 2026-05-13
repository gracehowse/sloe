/**
 * /discover — canonical Recipes Discover render path.
 * See `app/today/page.tsx` for the routing rationale.
 */
import type { Metadata } from "next";
import { HomePageClient } from "../HomePageClient";

export const metadata: Metadata = {
  title: "Discover — Suppr",
  description: "Discover community recipes tailored to your targets.",
};

export default function DiscoverPage() {
  return <HomePageClient />;
}
