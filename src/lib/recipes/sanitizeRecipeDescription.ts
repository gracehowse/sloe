/**
 * sanitizeRecipeDescription (2026-04-25)
 *
 * Strips internal/seeder bookkeeping prefixes from a recipe description before
 * it's shown to users. The "[TEMP SEED] " prefix was a cleanup tag the seeder
 * used to write into descriptions until the polish sweep dropped it; some rows
 * shipped with the tag still attached, and Recipe Detail rendered the field
 * directly. Stripping at the render boundary is the safety net.
 *
 * Add other prefixes here if we ever introduce more seed/admin tags — keep the
 * boundary single-source.
 */
const LEGACY_DESCRIPTION_PREFIXES = ["[TEMP SEED] ", "[TEMP SEED]"] as const;

export function sanitizeRecipeDescription(input: string | null | undefined): string {
  if (!input) return "";
  let s = input;
  for (const prefix of LEGACY_DESCRIPTION_PREFIXES) {
    if (s.startsWith(prefix)) {
      s = s.slice(prefix.length).trimStart();
    }
  }
  return s;
}
