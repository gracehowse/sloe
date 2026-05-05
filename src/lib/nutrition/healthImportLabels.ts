/**
 * healthImportLabels — shared rules for HealthKit-imported entry titles
 * whose source app didn't expose a real food name in the metadata.
 *
 * Background (N1 — Grace's 2026-05-03 launch screenshots):
 * MyFitnessPal, Lose It!, and several other trackers write per-meal
 * dietary samples into Apple HealthKit but DO NOT include the food
 * name in the metadata. When Suppr pulls those samples in via
 * `apps/mobile/lib/healthSync.ts`, `resolveFoodLabelFromHealthMetadata`
 * walks ~70 candidate metadata keys and, when nothing matches, falls
 * back to a synthetic title.
 *
 * The legacy fallback (`Food log (250 kcal)`) reads as a real food
 * item ("a thing literally called Food log"), which:
 *   - Made the "Eat again" card suggest re-logging meaningless rows.
 *   - Made the "Most-logged foods" surface a wall of identical placeholders.
 *   - Looked broken to MFP refugees on first impression.
 *
 * The new fallback (`MyFitnessPal entry · 250 kcal`) reads clearly as
 * a placeholder, names the source naturally (no need for the
 * `(via MyFitnessPal)` suffix), and stays scannable in long lists.
 *
 * This module:
 *   - Centralises the new fallback formatter
 *     (`formatHealthImportFallbackTitle`) so callers don't reinvent the
 *     string and platforms can't drift.
 *   - Centralises the predicate (`isHealthImportFallbackTitle`) used
 *     to suppress these synthetic rows from suggestion surfaces. The
 *     predicate matches BOTH the legacy `Food log (X kcal)` shape AND
 *     the new `<Source> entry · X kcal` shape — existing rows in user
 *     databases (TestFlight users have ~6+ months of imports) keep
 *     getting filtered correctly.
 *
 * Pure module — no React, no RN, no I/O. Mobile re-exports via
 * `apps/mobile/lib/healthImportLabels.ts`.
 */

/** Format the fallback title used when HealthKit metadata yields no food name. */
export function formatHealthImportFallbackTitle({
  sourceApp,
  calories,
}: {
  sourceApp: string;
  calories: number;
}): string {
  const cleanApp = (sourceApp ?? "").trim() || "Apple Health";
  const safeKcal = Number.isFinite(calories) ? Math.max(0, Math.round(calories)) : 0;
  // Format examples: "MyFitnessPal entry · 250 kcal", "Lose It! entry · 80 kcal".
  // The `·` separator + sentence-case "entry" reads as metadata, not a food name.
  return `${cleanApp} entry · ${safeKcal} kcal`;
}

/**
 * Match patterns Suppr generates when it can't extract a real food name
 * from a HealthKit dietary sample's metadata. Used to suppress these
 * synthetic rows from "Eat again" suggestions, "Most-logged foods"
 * stats, and similar surfaces where they'd be unhelpful or misleading.
 *
 *   1. Legacy: `Food log (250 kcal)` — produced by all builds before
 *      2026-05-03. Existing TestFlight user data still contains rows
 *      with this exact shape, so the filter must match it forever.
 *   2. New: `<Source> entry · 250 kcal` — produced by builds from
 *      2026-05-03 onwards. The `<Source>` is whatever the HealthKit
 *      sample's `sourceName` was; it's free-text from another app, so
 *      we accept any non-empty string up to the ` entry · ` separator.
 *
 * Case-insensitive on the literal portions; surrounding whitespace
 * tolerated.
 */
// Audit 2026-05-04 (third pass): Grace's actual TestFlight data carries
// titles like `Food log (250 kcal) (via MyFitnessPal)` — the ` (via X)`
// source-suffix is appended downstream of the fallback formatter. The
// original regex required the title to end with `(\d+ kcal)`, so the
// real-world rows slipped through and crowned the milestone modal's
// "Most-logged foods" list. Patterns now anchor only the leading shape
// and allow optional trailing source-suffix or any whitespace tail.
const HEALTH_IMPORT_FALLBACK_PATTERNS: readonly RegExp[] = [
  /^food log \(\d+ kcal\)(?:\s*\(via .+\))?\s*$/i,
  /^.+\s+entry\s+·\s+\d+\s+kcal(?:\s*\(via .+\))?\s*$/i,
];

export function isHealthImportFallbackTitle(title: string | null | undefined): boolean {
  if (typeof title !== "string") return false;
  const trimmed = title.trim();
  if (!trimmed) return false;
  return HEALTH_IMPORT_FALLBACK_PATTERNS.some((re) => re.test(trimmed));
}
