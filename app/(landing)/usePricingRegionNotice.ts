"use client";

/**
 * ENG-1441 (2026-07-21) — client-side region + VAT/"pricing coming
 * soon" note resolution for the landing page's Pricing section.
 * Extracted from `LandingPage.tsx` to keep that screen under the
 * ENG-621 400-line budget ratchet (`scripts/screen-line-budget.json`);
 * a plain `.ts` hook file isn't a "screen" surface the ratchet scans
 * (`.tsx` under `src/app/components` + `app` only).
 *
 * Before this change every consumer-facing price on the landing page
 * was a hardcoded GBP literal with zero region/VAT awareness — unlike
 * `/pricing`, which has carried this wiring since H7 (2026-04-21) /
 * ENG-1442 (2026-07-20).
 *
 * Resolves client-side via `detectRegionFromNavigatorLanguage` (not
 * server-side `detectRegion(headers())`) because `/` is kept fully
 * static for viral-traffic TTFB — see the 2026-05-15 decision recorded
 * in `app/page.tsx`; reading `headers()`/`cookies()` anywhere in that
 * route's Server Component tree would revert that optimisation.
 * `stripeTaxEnabled` / `eurPricingReady` come in as args from
 * `app/page.tsx` (plain `process.env` reads there don't force dynamic
 * rendering the way `headers()` does).
 */
import { useMemo } from "react";
import {
  detectRegionFromNavigatorLanguage,
  resolveRegionPricingNote,
  resolveRenderedVatNote,
} from "../../src/lib/region/detectRegion.ts";

export function usePricingRegionNotice(
  stripeTaxEnabled: boolean,
  eurPricingReady: boolean,
): { vatNote: string; regionNote: string } {
  // Region is stable per mount — hooks must run unconditionally, so
  // this is called before any early return in the calling component.
  const region = useMemo(() => detectRegionFromNavigatorLanguage(), []);
  const vatNote = resolveRenderedVatNote(region.vatNote, stripeTaxEnabled);
  const regionNote = resolveRegionPricingNote(region.currency, { eurPricingReady });
  return { vatNote, regionNote };
}
