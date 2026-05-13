/**
 * /progress — canonical Progress render path.
 * See `app/today/page.tsx` for the routing rationale.
 */
import type { Metadata } from "next";
import { HomePageClient } from "../HomePageClient";

export const metadata: Metadata = {
  title: "Progress — Suppr",
  description: "Your weight, weekly recap, and adaptive TDEE.",
};

export default function ProgressPage() {
  return <HomePageClient />;
}
