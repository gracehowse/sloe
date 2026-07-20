/**
 * Format the user-facing attribution line for a recipe card.
 *
 * Filters out internal seed-source strings that leaked from Supabase
 * import scripts ("Supp onboarding", "Suppr onboarding", "system",
 * etc.) so the Discover feed and library cards never display
 * developer-facing attribution as if it were a real source. Returns
 * `""` when no display-worthy attribution exists, callers should
 * branch on falsy and skip rendering the row.
 *
 * Audit: 2026-04-30 visual-qa flagged "Supp onboarding" appearing
 * under public Discover cards. The fix is at the display boundary —
 * cleaning up the seed data in the DB would invalidate user-attached
 * imports that legitimately use the same string.
 *
 * 2026-06-08 (rebrand display remap): legacy materialised rows can still
 * carry the old "Suppr Kitchen" source. Calm those historical rows to
 * "Sloe Kitchen" at display time. The current static catalogue records
 * "Sloe Kitchen" directly; both paths therefore render one byline.
 */

const INTERNAL_SEED_SOURCES: ReadonlySet<string> = new Set([
  "supp onboarding",
  "suppr onboarding",
  "onboarding",
  "system",
  "seed",
  "internal",
]);

/**
 * Stale brand strings → live brand, applied at the display boundary.
 * Keyed lowercase; the value preserves the user-facing casing. Keep
 * this list tiny and exact — it is a legacy-data calm-over, not a general
 * find/replace.
 */
const BRAND_DISPLAY_REMAP: ReadonlyMap<string, string> = new Map([
  ["suppr kitchen", "Sloe Kitchen"],
]);

export function displayAttribution(input: {
  creatorName?: string | null;
  source?: string | null;
}): string {
  const creator = (input.creatorName ?? "").trim();
  const source = (input.source ?? "").trim();
  const candidate = creator || source;
  if (!candidate) return "";
  if (INTERNAL_SEED_SOURCES.has(candidate.toLowerCase())) return "";
  const remapped = BRAND_DISPLAY_REMAP.get(candidate.toLowerCase());
  if (remapped) return remapped;
  return candidate;
}
