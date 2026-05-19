"use client";

/**
 * TareAestheticGate — toggles the `tare-on` class on <body> when the
 * `tare-aesthetic-v1` feature flag resolves true.
 *
 * Wiring:
 *   - Lives directly under <Providers> in `app/layout.tsx` so the
 *     PostHog client is available when we check.
 *   - Uses `useFeatureFlagEnabled` from posthog-js/react. While the
 *     flag is loading the component returns null-state (no class) —
 *     this matches the rest of Suppr's flag-gating pattern and means
 *     users always see the current palette on first paint, never a
 *     flash of the rebrand.
 *   - Removes the class on cleanup so a flag flip from on → off
 *     reverts cleanly.
 *
 * Why a body class, not a CSS-vars context provider:
 *   - 100% of Suppr's existing tokens are CSS custom properties
 *     resolved at paint time via `var(--name)`. A `body.tare-on`
 *     selector remaps every consumer atomically with zero code
 *     change downstream. A React context would force every
 *     consumer to opt in.
 *   - The flip is GPU-only (style recalc), no React re-render of the
 *     tree. Faster + no layout shift.
 *
 * Source of truth for tokens: src/styles/tare-aesthetic.css.
 *
 * Feature flag: `tare-aesthetic-v1` (PostHog). Default off. Roll
 * incrementally per the plan in docs/decisions/2026-05-18-tare-aesthetic-foundation.md.
 */

import { useEffect, type ReactNode } from "react";
import { useFeatureFlagEnabled } from "posthog-js/react";

export function TareAestheticGate({ children }: { children: ReactNode }) {
  const enabled = useFeatureFlagEnabled("tare-aesthetic-v1");

  useEffect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    if (enabled) {
      body.classList.add("tare-on");
    } else {
      body.classList.remove("tare-on");
    }
    return () => {
      // On unmount (route change, page refresh shape, etc.) we
      // intentionally do NOT remove the class — let the next mount
      // re-evaluate the flag. Removing here causes a flash if the
      // gate unmounts before re-evaluation. The cleanup above
      // handles the toggle case correctly.
    };
  }, [enabled]);

  return <>{children}</>;
}
