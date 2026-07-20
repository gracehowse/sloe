/**
 * /cookbook-import — canonical web Cookbook-Import path (ENG-1582).
 *
 * Like every route in the `(product)` group, this `page.tsx` renders `null`
 * on purpose. The shared shell at `app/(product)/layout.tsx` mounts
 * `<HomePageClient />` (→ `src/app/App.tsx`) once for the whole group; the App
 * reads `usePathname()` and derives the active view from the path. For
 * `/cookbook-import` the path-derived view is `"cookbook-import"`, which
 * `App.tsx#renderView()` renders as `<CookbookImport />` — the pick → parse →
 * review → save flow that mirrors the mobile screen at
 * `apps/mobile/app/cookbook-import.tsx`.
 *
 * Gated on the `cookbook_import_enabled` PostHog flag (same flag the mobile
 * entry points use). When the flag is off, `renderView()` falls back to the
 * Library surface so the route never dead-ends.
 *
 * Auth: `/cookbook-import` is not in `PUBLIC_ROUTES`, so an unauthed visit 307s
 * to `/login` via middleware before any client JS runs.
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Import cookbook — Sloe",
  description: "Import recipes from a cookbook PDF into your Sloe library.",
};

/** UI shell: `app/(product)/layout.tsx` → HomePageClient → App `case "cookbook-import"`. */
export default function CookbookImportPage() {
  return null;
}
