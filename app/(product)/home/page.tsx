/**
 * /home — legacy SPA shell.
 *
 * 2026-05-12 (premium-bar audit refuse-to-pass #2): the canonical
 * Today render path is now `/today` (see commit 77e460e). `/home`
 * is preserved for two reasons:
 *   1. Legacy bookmarks pointing at `/home?view=library` (etc.) need
 *      to keep landing the user on the right tab. The SPA still
 *      reads `?view=` as a fallback alias for path-derived view.
 *   2. Deep-linked recipe URLs of the shape `/home?recipe=ID` still
 *      surface from old shared links.
 *
 * Behaviour:
 *   - `/home` with no query  → 307 to `/today` (canonical landing).
 *   - `/home?view=X`         → render `<HomePageClient />` (legacy
 *                              alias resolves to view X via
 *                              `?view=` in App.tsx).
 *   - `/home?recipe=ID`      → render `<HomePageClient />` so the
 *                              recipe deep-link fires.
 *
 * Auth gating is unchanged — the client gate (`useHomeProfileGate` in
 * HomePageClient) still bounces unauthed visitors to /login and
 * onboarding-incomplete users to /onboarding. Middleware also catches
 * unauthed access (/home is not in PUBLIC_ROUTES) and 307s to /login
 * before any client JS runs.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Sloe — Dashboard",
  description:
    "Your meal plan, today's macros, and recipe library — all in one place.",
};

export default async function HomeRoute({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string | string[]; recipe?: string | string[] }>;
}) {
  const resolved = (await searchParams) ?? {};
  // Land on /today when no legacy query params signal a specific
  // legacy view / deep link.
  if (!resolved.view && !resolved.recipe) {
    redirect("/today");
  }
  return null;
}
