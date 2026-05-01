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
 */

const INTERNAL_SEED_SOURCES: ReadonlySet<string> = new Set([
  "supp onboarding",
  "suppr onboarding",
  "onboarding",
  "system",
  "seed",
  "internal",
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
  return candidate;
}
