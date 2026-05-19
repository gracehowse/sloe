"use client";

/**
 * TareAestheticGate — toggles the `tare-on` class on <body> when the
 * `tare-aesthetic-v1` feature flag resolves true OR when a dev-preview
 * override is set on the current device.
 *
 * Resolution order (first match wins):
 *
 *   1. URL param `?tare=on` / `?tare=off`  — overrides for one session,
 *      persisted to localStorage so the override survives navigation
 *      within the app. `?tare=` (empty value) or `?tare=clear` resets
 *      the override, letting the PostHog flag decide again.
 *
 *   2. localStorage key `suppr.tare-preview`  — value `"on"` or `"off"`
 *      previously set via the URL param. This is the per-device opt-in
 *      Grace uses to review aesthetic increments before they ramp.
 *
 *   3. PostHog feature flag `tare-aesthetic-v1`  — the canonical roll
 *      mechanism. Default off until per-phase rampcompletes.
 *
 * The override is intentionally per-device + per-browser, not per-user
 * server-side. We don't want the preview state to follow Grace's
 * account into a TestFlight build or onto another machine — the
 * point is fast local review, not coordinated rollout. The PostHog
 * flag stays the canonical truth for everyone else.
 *
 * How Grace uses it:
 *   - Preview ON   →  open any page with `?tare=on` in the URL
 *   - Preview OFF  →  `?tare=off` (or `?tare=clear` to drop the override
 *                     and let the flag decide again)
 *
 * Wiring:
 *   - Lives directly under <Providers> in `app/layout.tsx` so the
 *     PostHog client is available when we check.
 *   - URL param read once at mount + on pathname change.
 *   - localStorage read on every render via `useState(initialiser)`
 *     so a flip from one tab affects new mounts in other tabs after
 *     reload (we don't broadcast cross-tab — keeps the preview
 *     deliberate, not magical).
 *   - The `tare-on` class is added/removed in a useEffect so the
 *     resolution can update on the fly without re-rendering the
 *     subtree.
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
 * incrementally per the plan in
 * docs/decisions/2026-05-19-suppr-design-direction-v1.md.
 */

import { useEffect, useState, type ReactNode } from "react";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { usePathname } from "next/navigation";

const PREVIEW_STORAGE_KEY = "suppr.tare-preview";
type PreviewState = "on" | "off" | null; // null = no override, defer to flag

/**
 * Read the `?tare=` URL param from window.location directly.
 *
 * We deliberately do NOT use Next 15's `useSearchParams()` hook here.
 * That hook requires the calling component to be wrapped in a
 * `<Suspense>` boundary or the entire route is opted into CSR — too
 * expensive a price for a dev-preview override. Reading window
 * directly is client-only, which matches the gate's own SSR posture
 * (the `useEffect` block runs only on the client).
 */
function readUrlPreviewParam(): "on" | "off" | "clear" | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("tare");
    if (raw == null) return null;
    if (raw === "on" || raw === "off") return raw;
    if (raw === "" || raw === "clear") return "clear";
    return null;
  } catch {
    return null;
  }
}

/**
 * Read the persisted preview state from localStorage. Returns null on
 * SSR, when localStorage is unavailable, or when no override has been
 * set. Defensive — any error reverts to "no override".
 */
function readPreviewState(): PreviewState {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
    if (raw === "on" || raw === "off") return raw;
    return null;
  } catch {
    return null;
  }
}

/**
 * Persist the preview state. `null` clears the override (so the
 * PostHog flag takes over). Errors swallowed — storage failures
 * shouldn't break the page.
 */
function writePreviewState(next: PreviewState): void {
  if (typeof window === "undefined") return;
  try {
    if (next === null) {
      window.localStorage.removeItem(PREVIEW_STORAGE_KEY);
    } else {
      window.localStorage.setItem(PREVIEW_STORAGE_KEY, next);
    }
  } catch {
    /* storage denied — preview reverts to flag-only on next page */
  }
}

export function TareAestheticGate({ children }: { children: ReactNode }) {
  const flagEnabled = useFeatureFlagEnabled("tare-aesthetic-v1");
  const pathname = usePathname();

  // Track the localStorage override in React state so URL-param flips
  // re-render the gate. Initialise from storage on first mount (SSR-safe
  // because `readPreviewState` returns null in SSR).
  const [preview, setPreview] = useState<PreviewState>(() => readPreviewState());

  // Handle URL-param overrides on mount + every pathname change.
  // `?tare=on` / `?tare=off` set the preview; `?tare=clear` (or empty
  // value) drops it back to flag-only.
  useEffect(() => {
    const param = readUrlPreviewParam();
    if (param === null) return; // param absent — leave preview as-is
    if (param === "clear") {
      writePreviewState(null);
      setPreview(null);
    } else {
      writePreviewState(param);
      setPreview(param);
    }
    // We deliberately do NOT strip the URL param from the address bar.
    // Leaving it visible is the cheapest possible "you're in preview
    // mode" signal — Grace can see at a glance which mode the tab is
    // running in. The localStorage write makes the override persist
    // across subsequent navigations within the app even after she
    // removes the param.
  }, [pathname]);

  // Resolution: preview override wins; otherwise defer to the PostHog
  // flag. `useFeatureFlagEnabled` returns undefined while loading, so
  // we treat undefined as "not yet decided" → off (matches existing
  // Suppr flag-gating semantics).
  const resolved: boolean =
    preview === "on" ? true : preview === "off" ? false : flagEnabled === true;

  // Apply the class. The gate is purely presentational — no children
  // re-render on toggle.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    if (resolved) {
      body.classList.add("tare-on");
    } else {
      body.classList.remove("tare-on");
    }
  }, [resolved]);

  return <>{children}</>;
}
