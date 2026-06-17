/**
 * /plan-import — canonical web Plan-Import path (ENG-696).
 *
 * Like every route in the `(product)` group, this `page.tsx` renders `null`
 * on purpose. The shared shell at `app/(product)/layout.tsx` mounts
 * `<HomePageClient />` (→ `src/app/App.tsx`) once for the whole group; the App
 * reads `usePathname()` and derives the active view from the path. For
 * `/plan-import` the path-derived view is `"plan-import"`, which
 * `App.tsx#renderView()` renders as `<PlanImport />` — the paste → parse →
 * review → assessment → commit flow that mirrors the mobile screen at
 * `apps/mobile/app/plan-import.tsx`.
 *
 * Gated on the `plan_import_enabled` PostHog flag (same flag the mobile entry
 * points use). When the flag is off, `renderView()` falls back to the Plan
 * surface so the route never dead-ends.
 *
 * Auth: `/plan-import` is not in `PUBLIC_ROUTES`, so an unauthed visit 307s to
 * `/login` via middleware before any client JS runs.
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Import meal plan — Sloe",
  description: "Import an existing meal plan into Sloe.",
};

/** UI shell: `app/(product)/layout.tsx` → HomePageClient → App `case "plan-import"`. */
export default function PlanImportPage() {
  return null;
}
