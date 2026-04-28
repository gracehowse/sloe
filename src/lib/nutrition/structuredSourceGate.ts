/**
 * structuredSourceGate — the single load-bearing predicate that says
 * whether an ingredient came from a structured nutrition catalog
 * (USDA / OFF / FatSecret / Edamam) versus an LLM extract or other
 * heuristic source.
 *
 * GW-08 fix (audit 2026-04-28). Pre-fix the import path at
 * `apps/mobile/lib/saveImportedRecipe.ts:210` wrote
 * `is_verified: (m?.calories ?? 0) > 0` — every successful LLM
 * extract was marked verified. That single bool then propagated
 * through the recipe-level `is_verified` rollup, which fed every
 * "USDA verified" / "OFF adjusted" TrustChip across Discover,
 * Library, and Recipe Detail.
 *
 * The audit's recommended fix: gate `is_verified` on whether the
 * macros actually came from a structured catalog. LLM extracts +
 * unsourced rows stay unverified; only catalog-matched rows count.
 *
 * Canonical source strings are written by `verifyIngredients.ts`
 * (`USDA` / `OFF` / `FatSecret` / `Edamam`). Variants we tolerate:
 *   - case-insensitive ("usda", "Open Food Facts", "openfoodfacts")
 *   - parenthetical / suffixed labels ("USDA Foundation",
 *     "FatSecret Premier")
 *
 * Anything else — including null, empty string, `"AI photo"`,
 * `"AI voice"`, `"Estimated"`, `"Manual"`, `"Custom"`, hostname
 * strings — returns `false`.
 *
 * Cross-platform: shared lib so web + mobile use identical gating.
 */

const STRUCTURED_PATTERNS: readonly RegExp[] = [
  /\busda\b/i,
  /\boff\b/i,
  /\bopen\s*food\s*facts\b/i,
  /\bopenfoodfacts\b/i,
  /\bfat\s*secret\b/i,
  /\bfatsecret\b/i,
  /\bedamam\b/i,
];

/**
 * `true` when the ingredient's source string identifies a structured
 * catalog (USDA / OFF / FatSecret / Edamam). `false` for null, empty,
 * LLM-extracted, manual, or any unrecognised source.
 */
export function isStructuredSource(source: string | null | undefined): boolean {
  if (!source) return false;
  const s = String(source).trim();
  if (!s) return false;
  return STRUCTURED_PATTERNS.some((re) => re.test(s));
}
