/**
 * safeBack — never-dead back-button helper.
 *
 * F-19 (2026-04-19, TestFlight `ADACe4M-PsjNMMnlAwMPPSQ`). The tester
 * hit a state where the meal-detail header chevron did nothing. When
 * the expo-router stack has no history (cold-start deep link, a
 * caller that used `router.replace`, or a nav reset), `router.back()`
 * silently no-ops. This helper inspects stack depth and falls back to
 * `router.replace(fallback)` so the control always resolves.
 *
 * The sibling hook `use-safe-back.ts` is the React-rendered entry
 * point — it wraps this same function so hook and non-hook callers
 * share identical semantics and tests.
 */

import type { Href, Router } from "expo-router";

export type SafeBackRouter = Pick<Router, "back" | "replace" | "canGoBack">;

/**
 * Navigate back if the stack has history; otherwise `replace(fallback)`.
 *
 * `router.canGoBack()` mirrors the underlying navigation container, so
 * we trust it over guessing from params or pathnames.
 */
export function safeBack(router: SafeBackRouter, fallback: Href = "/"): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}
