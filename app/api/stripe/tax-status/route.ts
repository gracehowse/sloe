/**
 * GET /api/stripe/tax-status
 *
 * ENG-1441 (2026-07-21) — surfaces the `STRIPE_TAX_ENABLED` flag to
 * client components that have no clean Server Component ancestor to
 * read it from as a prop.
 *
 * `/pricing/page.tsx` and `app/(landing)/LandingPage.tsx`'s host
 * (`app/page.tsx`) are both single Server Component call sites and read
 * `process.env.STRIPE_TAX_ENABLED` directly, passing it down as a prop
 * — no route needed there. `UpgradePaywallDialog` has no equivalent
 * single choke point (mounted from `src/app/App.tsx`, itself nested
 * under the `(product)` route group's client shell, AND separately
 * from `src/app/components/onboarding/steps/upgrade.tsx` under
 * `/onboarding`'s step machinery) and is explicitly barred from
 * self-fetching data that gates its own render per D12 §6.3 ("no
 * loading spinner on an intent-driven modal") — but this route is
 * fetched once, ambiently, by `useStripeTaxEnabled()`
 * (`src/lib/stripe/useStripeTaxEnabled.ts`) well before the dialog is
 * ever opened, not by the dialog itself, so that constraint isn't
 * violated: the dialog always has a value (a safe default, or the
 * resolved one) by the time it renders.
 *
 * Deliberately unauthenticated — free/pre-signup visitors (the
 * upgrade dialog's actual audience) have no session, and this flag is
 * not sensitive. No DB round-trip; same env var the checkout route and
 * `/pricing` already read.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET(): NextResponse {
  return NextResponse.json(
    { ok: true, stripeTaxEnabled: process.env.STRIPE_TAX_ENABLED === "true" },
    // Short cache — this only changes on redeploy, but keep it brief so a
    // flag flip doesn't need a client hard-refresh to propagate.
    { status: 200, headers: { "Cache-Control": "public, max-age=300" } },
  );
}
