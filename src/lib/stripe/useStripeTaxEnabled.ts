"use client";

import { useEffect, useState } from "react";

/**
 * ENG-1441 (2026-07-21) — client hook surfacing `STRIPE_TAX_ENABLED`
 * (via `GET /api/stripe/tax-status`) for components with no Server
 * Component ancestor to hand it down as a prop. See the route's doc
 * comment (`app/api/stripe/tax-status/route.ts`) for why this exists
 * instead of prop-threading, specifically for `UpgradePaywallDialog`.
 *
 * Defaults to `false` — the same fail-safe direction
 * `resolveRenderedVatNote` already takes (flag off/unknown ⇒ never
 * claim VAT-inclusive pricing that might not be true). Callers render
 * immediately with this default; the value swaps in place if the fetch
 * resolves `true` before the user reaches the tax-clause text, and stays
 * `false` (the honest "excludes any applicable taxes" branch) on any
 * fetch failure rather than guessing.
 *
 * Module-level cache: the flag is fixed per-deployment, so every
 * component that calls this hook within a session shares one fetch
 * instead of re-requesting on every mount (every dialog open, every
 * onboarding step render).
 */

let cachedValue: boolean | null = null;
let inFlight: Promise<boolean> | null = null;

async function fetchStripeTaxEnabled(): Promise<boolean> {
  if (cachedValue != null) return cachedValue;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await fetch("/api/stripe/tax-status", { cache: "default" });
      if (!res.ok) return false;
      const data = (await res.json()) as { ok?: boolean; stripeTaxEnabled?: boolean };
      const resolved = data.ok === true && data.stripeTaxEnabled === true;
      cachedValue = resolved;
      return resolved;
    } catch {
      // Fail closed — never claim VAT-inclusive pricing on an unknown flag.
      return false;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

export function useStripeTaxEnabled(): boolean {
  const [enabled, setEnabled] = useState<boolean>(cachedValue ?? false);

  useEffect(() => {
    if (cachedValue != null) {
      setEnabled(cachedValue);
      return;
    }
    let active = true;
    fetchStripeTaxEnabled().then((value) => {
      if (active) setEnabled(value);
    });
    return () => {
      active = false;
    };
  }, []);

  return enabled;
}
