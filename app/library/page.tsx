/**
 * /library — canonical Recipes Library render path.
 * See `app/today/page.tsx` for the routing rationale.
 */
import type { Metadata } from "next";
import { HomePageClient } from "../HomePageClient";

export const metadata: Metadata = {
  title: "Library — Suppr",
  description: "Your saved recipes.",
};

export default function LibraryPage() {
  return <HomePageClient />;
}
