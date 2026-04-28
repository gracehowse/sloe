/**
 * recipeTrust — derive a `TrustChip` variant for a recipe (or
 * recipe ingredient row) from the loose source/confidence fields
 * we persist.
 *
 * Production design spec — 2026-04-27 §1.6 + Phase 4 trust posture
 * sweep. Authority: D-2026-04-27-16.
 *
 * Variants (per spec):
 *   - `usda`         — high-confidence, USDA-derived nutrition.
 *   - `off-adjusted` — Open Food Facts (we apply portion adjustment).
 *   - `estimated`    — anything AI / unverified / low-confidence.
 *   - `manual`       — user-entered or no source claim at all.
 *
 * Inputs are deliberately loose so this single helper covers:
 *   - Whole-recipe trust (uses dominant ingredient source).
 *   - Per-ingredient row trust (single source string + verified flag).
 *   - Search-result trust (single source string).
 *
 * Cross-platform: shared lib so web + mobile use identical variants.
 */

import type { TrustChipVariant } from "../../app/components/ui/trust-chip";
import { mapMealSourceToDot } from "./sourceMap";

export interface RecipeTrustInput {
  /** Free-form source label (USDA / OFF / FatSecret / AI / Manual / null). */
  source?: string | null;
  /** Whether the row has been validated against a structured DB entry. */
  isVerified?: boolean | null;
}

/**
 * Map a single source/verified pair to the `TrustChip` variant the
 * row should render.
 *
 * Decision matrix:
 *   verified=true  + USDA       → usda
 *   verified=true  + OFF        → off-adjusted
 *   verified=true  + FatSecret  → off-adjusted   (we treat FS as "adjusted source")
 *   verified=false + any source → estimated      (don't claim verified)
 *   verified=true  + Manual     → manual
 *   any            + null/empty → manual
 *
 * The "AI" sub-key always maps to `estimated` regardless of verified
 * because AI estimates are calibration-derived, not catalog-validated.
 */
export function mapToTrustVariant(input: RecipeTrustInput): TrustChipVariant {
  const dot = mapMealSourceToDot(input.source ?? null);
  const verified = Boolean(input.isVerified);
  const hasSourceClaim =
    input.source != null && String(input.source).trim().length > 0;

  if (dot === "ai") return "estimated";
  if (!verified) {
    // Unverified row. If the row has an explicit "Manual" source
    // claim (the user typed in macros themselves), keep it as
    // `manual` — that's a deliberate provenance choice. Anything
    // else (incl. null source) is `estimated` so we never claim
    // verified provenance we can't back up.
    if (dot === "manual" && hasSourceClaim) return "manual";
    return "estimated";
  }
  switch (dot) {
    case "usda":
      return "usda";
    case "off":
    case "fatsecret":
      return "off-adjusted";
    case "manual":
      return "manual";
  }
}

/**
 * Aggregate per-ingredient trust into a single recipe-card / detail
 * hero variant.
 *
 * Rule:
 *   - any AI / unverified / no-source row → `estimated` (worst-case wins).
 *   - all rows USDA-verified              → `usda`.
 *   - mix of USDA + OFF (all verified)    → `off-adjusted` (the lower bar).
 *   - all manual                          → `manual`.
 *   - empty (no ingredients)              → `estimated` (be honest).
 */
export function aggregateRecipeTrust(rows: readonly RecipeTrustInput[]): TrustChipVariant {
  if (rows.length === 0) return "estimated";

  let sawEstimated = false;
  let sawOff = false;
  let allUsda = true;
  let allManual = true;

  for (const row of rows) {
    const variant = mapToTrustVariant(row);
    if (variant === "estimated") {
      sawEstimated = true;
      allUsda = false;
      allManual = false;
    } else if (variant === "off-adjusted") {
      sawOff = true;
      allUsda = false;
      allManual = false;
    } else if (variant === "usda") {
      allManual = false;
    } else if (variant === "manual") {
      allUsda = false;
    } else {
      // gluten-* shouldn't appear from this path
      allUsda = false;
      allManual = false;
    }
  }

  if (sawEstimated) return "estimated";
  if (allUsda) return "usda";
  if (sawOff) return "off-adjusted";
  if (allManual) return "manual";
  return "estimated";
}

/**
 * Convenience for surfaces that only have a single recipe-level source
 * label (Discover catalog cards, imported recipes pre-verify, etc.).
 */
export function recipeLevelTrust(input: RecipeTrustInput): TrustChipVariant {
  return mapToTrustVariant(input);
}
