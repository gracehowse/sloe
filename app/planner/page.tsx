/**
 * /planner — web stub directing users to the iOS Plan tab.
 *
 * Group E Card 5 (premium-bar audit 2026-05-14): the canonical web
 * meal-plan route is `/plan` (mounts `HomePageClient` → the
 * `MealPlanner` view in the shared App shell). `/planner` was
 * previously a 404 — testers who typed the URL or followed an old
 * "go to your planner" copy hit a dead end instead of either
 * (a) the working web plan, or (b) clear instructions to use the
 * iOS app where the planner has its richer surface.
 *
 * This stub renders an empty-state surface that:
 *   - Explains that the meal plan lives in the iOS app today.
 *   - Cross-links to the App Store so users can install Suppr.
 *   - Points to `/plan` for the lighter web equivalent so the page
 *     isn't a dead end (no orphan URL).
 *
 * The page still mounts inside the shared product layout so the
 * nav chrome (header, footer) is visible — this is a content stub,
 * not a 404 shell.
 *
 * Cross-platform note: this is a web-side-only divergence (mobile
 * has the rich Plan tab at `apps/mobile/app/(tabs)/planner.tsx`).
 * Logged alongside the documented `/planner`-vs-`/plan` parity
 * carve-out — see `docs/decisions/2026-04-19-pricing-default-
 * billing-period-divergence.md` for the carve-out pattern.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Smartphone } from "lucide-react";

export const metadata: Metadata = {
  title: "Plan — Suppr",
  description:
    "Your weekly meal plan lives in the Suppr iOS app. Generate, adjust, and shop from your phone.",
};

/**
 * Public TestFlight URL — when public testing opens we swap this
 * for the apps.apple.com / testflight.apple.com link. Today
 * (2026-05-14) Suppr is in private TestFlight with N=1 testers, so
 * the link resolves to a placeholder until the public app store
 * surface goes live.
 */
const APP_STORE_URL = "#";

export default function WebPlannerStubPage() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-6 py-16">
      <div className="max-w-md w-full text-center">
        <div
          className="mx-auto mb-6 w-16 h-16 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "rgba(76, 108, 224, 0.10)" }}
          aria-hidden="true"
        >
          <CalendarDays className="w-12 h-12" style={{ color: "#7a8fff" }} strokeWidth={1.75} />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3 leading-tight">
          Your meal plan lives in the iOS app
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-8">
          Open Suppr on iPhone to view, generate, and adjust your weekly meal plan.
          Your shopping list syncs here.
        </p>
        <div className="flex flex-col items-center gap-3">
          <a
            href={APP_STORE_URL}
            className="inline-flex items-center justify-center gap-2 w-full max-w-xs px-5 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-sm hover:opacity-90 transition-opacity"
            data-testid="planner-stub-get-app"
          >
            <Smartphone className="w-4 h-4" aria-hidden="true" />
            Get the app
          </a>
          <Link
            href="/plan"
            className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            data-testid="planner-stub-go-to-plan"
          >
            Or open the web plan view
          </Link>
        </div>
      </div>
    </main>
  );
}
