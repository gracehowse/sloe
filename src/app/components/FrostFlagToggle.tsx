"use client";

/**
 * FrostFlagToggle — applies the `brand_frost_secondary` exploration flag to the
 * web app + marketing site by toggling the `flag-frost` class on `<html>`.
 *
 * The Frost direction (decision doc:
 * `docs/brand/2026-06-07-secondary-colour-exploration.md`) moves the clay
 * secondary accent → Damson `#6A4B7A`. The colour swap itself lives entirely in
 * CSS (`.flag-frost` overrides in `src/styles/theme.css`); this component only
 * decides whether the class is present, after PostHog flags resolve.
 *
 * Mounted in web `Providers` near `AnalyticsProvider` so it covers BOTH the
 * authenticated app and the marketing/landing pages from a single point.
 *
 * Renders nothing — it's a side-effect-only component.
 *
 * Flag readiness: PostHog fetches flags asynchronously after init, so we sync
 * on mount AND subscribe via `posthog.onFeatureFlags`. The mount sync also
 * honours the dev/E2E force path — `isFeatureEnabled` reads
 * `window.__SUPPR_FORCE_FLAGS__` (Playwright `addInitScript` /
 * `?__force_flags=` / `--flags`), which fires even when PostHog never
 * initialises (no key in the goldens fixture). That's how the flag-ON visual
 * goldens render the Frost palette.
 *
 * `brand_frost_secondary` is intentionally NOT in `REDESIGN_DEFAULT_ON`: the
 * old clay path stays the default and ramps later via PostHog.
 *
 * Mobile parity: `apps/mobile/context/theme.tsx` (`useAccent`) + the migrated
 * consumers — there is no DOM class on native, so the swap is delivered through
 * the theme context's `accent` object instead.
 */

import { useEffect } from "react";
import posthog from "posthog-js";

import { isFeatureEnabled } from "../../lib/analytics/track.ts";

const FLAG = "brand_frost_secondary";
const CLASS = "flag-frost";

export function FrostFlagToggle() {
  useEffect(() => {
    const sync = () => {
      if (typeof document === "undefined") return;
      document.documentElement.classList.toggle(CLASS, isFeatureEnabled(FLAG));
    };
    // Mount read — covers the dev/E2E force path (no PostHog) and the
    // already-resolved-flags case.
    sync();
    // Re-sync once PostHog flags arrive (and on any later refresh) so a
    // dashboard ramp flips the palette without a manual reload.
    let unsub: () => void = () => {};
    try {
      unsub = posthog.onFeatureFlags(() => sync());
    } catch {
      /* PostHog not initialised (no key / consent declined) — mount read stands */
    }
    return () => {
      try {
        unsub();
      } catch {
        /* noop */
      }
      // Leave the class as-is on unmount: Providers is app-root and never
      // unmounts in practice; toggling it off here would only flicker during
      // a fast-refresh remount in dev.
    };
  }, []);

  return null;
}

export default FrostFlagToggle;
