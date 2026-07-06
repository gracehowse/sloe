/**
 * classifySource — canonical mapping from a free-form `source` string (the
 * loose union persisted across the app: "USDA", "USDA (adjusted)",
 * "FatSecret", "OFF", "Edamam", "AI photo", "Quick add", "Manual", etc.) to
 * the three-tier trust badge shown on `NutritionSourceBadge`.
 *
 * ENG-1419 (2026-07-05 deep audit, nutrition trust, tl-F1/label-F1 +
 * tl-F3/label-F3): web and mobile each had their OWN copy of this function,
 * and they had drifted:
 *   - Mobile's "verified" bucket was missing `fatsecret` and `edamam` —
 *     a FatSecret-sourced row rendered green ("Structured") on web and grey
 *     ("Manual") on mobile for the exact same underlying data.
 *   - Mobile had no `adjusted` / `quick` / `barcode` demotion branches, so
 *     e.g. "USDA (adjusted)" — which should read as an estimate, not a
 *     verified match — over-trusted on mobile (matched the bare `usda`
 *     check and rendered "Structured").
 *   - Mobile checked `s.includes("off")` (a loose substring match) where
 *     web checked `s === "off"` (exact) — the loose form would false-match
 *     any source string containing "off" as a substring (e.g. a future
 *     "Cutoff" or "Kickoff"-named source), silently misclassifying it as
 *     Open Food Facts-verified.
 *
 * This file is the single source of truth for both platforms. Web imports
 * it directly; mobile imports it via `@suppr/nutrition-core/classifySource`
 * (a thin re-export, same pattern as every other shared nutrition helper —
 * see `nutrition-core/sourceMap.ts`).
 *
 * Order matters: the demotion checks (`adjusted`, `quick`, `barcode`) MUST
 * run before the verified-source checks, so e.g. "FatSecret (adjusted)"
 * still demotes to `estimated` regardless of which provider adjusted it.
 */
export type SourceTier = "verified" | "estimated" | "manual";

export function classifySource(source?: string | null): SourceTier {
  if (source == null || typeof source !== "string") return "manual";
  const s = source.trim().toLowerCase();
  if (!s) return "manual";

  if (s.includes("adjusted")) return "estimated";
  if (s.includes("quick") || s.includes("barcode")) return "estimated";

  if (
    s.includes("usda") ||
    s.includes("fdc") ||
    s.includes("openfoodfacts") ||
    s.includes("open food facts") ||
    s.includes("fatsecret") ||
    s.includes("edamam") ||
    s === "off"
  ) {
    return "verified";
  }

  if (
    s.includes("ai") ||
    s.includes("photo") ||
    s.includes("voice") ||
    s.includes("import") ||
    s.includes("openai") ||
    s.includes("recipe")
  ) {
    return "estimated";
  }

  return "manual";
}
