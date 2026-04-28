/**
 * sourceMap — canonical mapping from `meal.source` strings (the loose
 * union we persist in the journal) to the typed `SourceDot.source`
 * union (`usda` / `off` / `fatsecret` / `manual` / `ai`).
 *
 * Production design spec — 2026-04-27 §1.6.
 * Authority: D-2026-04-27-16 (consistent trust posture on every
 * macro-bearing row).
 *
 * The journal's `source` column is loosely typed (string | null) and
 * carries values like `"USDA"`, `"OFF"`, `"AI photo"`, `"Custom"`,
 * `"FatSecret"`, etc. The SourceDot primitive expects one of five
 * canonical lower-case keys. This file is the single point of
 * translation — every macro-bearing row that wants a SourceDot
 * imports `mapMealSourceToDot`.
 *
 * Cross-platform: shared lib so web + mobile use identical mapping.
 */

import type { SourceDotSource } from "../../app/components/ui/source-dot";

/**
 * Map a free-form journal source string to the SourceDot source key.
 *
 * Defaults to `"manual"` when the source is null/empty/unrecognised
 * (matches the spec § "Manual" fallback).
 */
export function mapMealSourceToDot(source: string | null | undefined): SourceDotSource {
  if (!source) return "manual";
  const s = String(source).trim().toLowerCase();

  if (!s) return "manual";

  if (s.includes("usda")) return "usda";
  if (
    s.includes("openfoodfacts") ||
    s.includes("open food facts") ||
    s === "off" ||
    s.startsWith("off ") ||
    s.startsWith("off·") ||
    s.startsWith("off ·")
  ) {
    return "off";
  }
  if (s.includes("fatsecret")) return "fatsecret";
  if (s.includes("ai") || s.includes("photo") || s.includes("voice") || s.includes("estimat")) {
    return "ai";
  }
  if (s.includes("custom") || s.includes("manual") || s === "user") {
    return "manual";
  }

  // Common journal labels we've used historically:
  switch (s) {
    case "barcode":
      return "off"; // historical: barcode lookups land in OFF
    case "recipe":
      return "manual"; // recipe-derived rows aren't a source proper
  }

  return "manual";
}
