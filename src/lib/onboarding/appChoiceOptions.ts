/**
 * ENG-990 (2026-06-08) — the option set for the "Coming from another
 * app?" onboarding step (`app-choice`).
 *
 * The list of *importable* apps is derived from the CSV-import adapter
 * registry (`src/lib/imports/csv/adapters/registry.ts`) so it can never
 * drift from reality: an app only appears with an "import your history"
 * affordance when a live adapter exists to parse its export. This is the
 * brief's "if only some apps have adapters, only surface those; don't
 * show dead options" rule, enforced in code rather than by hand.
 *
 * Shared between web (`src/app/components/onboarding/steps/app-choice.tsx`)
 * and mobile (`apps/mobile/components/onboarding/steps/app-choice.tsx`)
 * via the `@suppr/shared` path alias, so both platforms render the same
 * tiles in the same order with the same labels — cross-platform parity
 * by construction, not by duplication.
 *
 * Mirrors Yazio's `calorie_counting.app_choice.{mfp,loseit,…}` capture
 * (see `docs/research/2026-06-08-yazio-teardown.md`).
 */

import { REGISTERED_ADAPTERS } from "../imports/csv/adapters/registry";
import type { AppChoice } from "./state";

/** One selectable app on the app-choice step. */
export interface AppChoiceOption {
  /** Stable choice id — an adapter `source` for importable apps,
   *  `"other"` / `"none"` for the two non-adapter tiles. Emitted as the
   *  `app` property of `onboarding_app_choice` and stored in
   *  `state.appChoice`. */
  id: Exclude<AppChoice, null>;
  /** Human-readable label rendered on the tile. */
  label: string;
  /** True when picking this tile routes the user toward our CSV importer
   *  (an adapter exists). Drives the data-bridges importer pre-highlight
   *  and the `has_importer` analytics property. */
  hasImporter: boolean;
}

/**
 * Build the ordered list of app-choice tiles.
 *
 * Order: every app with a live adapter first (registry order, which puts
 * MyFitnessPal first — our priority refugee cohort), then the two
 * always-present non-adapter tiles: "Another app" (`other`) and
 * "I'm starting fresh" (`none`).
 *
 * Pure + dependency-light (no React, no platform APIs) so it runs
 * identically under web RSC, React Native, and vitest.
 */
export function buildAppChoiceOptions(): AppChoiceOption[] {
  const importable: AppChoiceOption[] = REGISTERED_ADAPTERS.map((adapter) => ({
    // Adapter `source` ids ("mfp", "lose-it", …) are a subset of the
    // AppChoice union by construction (see `AppChoice` in state.ts — keep
    // the two in sync when adding an adapter).
    id: adapter.source as Exclude<AppChoice, null>,
    label: adapter.displayName,
    hasImporter: true,
  }));

  return [
    ...importable,
    { id: "other", label: "Another app", hasImporter: false },
    { id: "none", label: "I'm starting fresh", hasImporter: false },
  ];
}

/**
 * Does the given choice route into our CSV importer? True only for
 * choices backed by a live adapter. Used by the data-bridges step to
 * decide whether to pre-highlight the importer, and to compute the
 * `has_importer` analytics property — kept here (not inlined) so web +
 * mobile compute it identically.
 */
export function appChoiceHasImporter(choice: AppChoice): boolean {
  if (choice == null || choice === "other" || choice === "none") return false;
  return REGISTERED_ADAPTERS.some((adapter) => adapter.source === choice);
}

/**
 * The human-readable name for an importable app choice (e.g. `"mfp"` →
 * `"MyFitnessPal"`), sourced from the adapter `displayName` so the
 * importer pre-highlight copy never drifts from the picker label.
 * Returns `null` for `other` / `none` / `null`.
 */
export function appChoiceDisplayName(choice: AppChoice): string | null {
  if (choice == null || choice === "other" || choice === "none") return null;
  return (
    REGISTERED_ADAPTERS.find((adapter) => adapter.source === choice)
      ?.displayName ?? null
  );
}
