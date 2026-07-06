/**
 * avatarInitials — the ONE shared initials derivation for every
 * avatar/initials chip on both platforms (ENG-1383).
 *
 * Before this existed, each surface rolled its own: the household
 * helper took first + LAST whitespace chunk, so the data-rich persona
 * "Data-Rich Tester (persona)" rendered as "D(" — a punctuation glyph
 * in the avatar. The rule set here:
 *
 *   1. Separator punctuation (hyphen/en–em dash, underscore, slash)
 *      is a word boundary — "Data-Rich" is two words.
 *   2. Every word is stripped to its letters only (Unicode-aware), so
 *      "(persona)", "🌟", "2nd" contribute "persona", nothing, "nd".
 *   3. Take the first letter of the first TWO alphabetic words,
 *      uppercased — "Data-Rich Tester" → "DR", "Sam Taylor" → "ST".
 *   4. Single-word names keep the established two-letter chip
 *      treatment — "Alex" → "AL" (pinned since the 2026-04-20
 *      prototype port; a one-letter chip next to two-letter siblings
 *      reads as a glitch).
 *   5. Designed empty-input fallback: "?" — a chip with a blank
 *      avatar reads as a broken row.
 *
 * Consumers: `householdMemberInitials` (household chips web + mobile,
 * Progress-header HouseholdBar chips), the web desktop-sidebar account
 * row, and mobile `HouseholdCard`. Import via `@/lib/avatarInitials`
 * (web) / `@suppr/shared/avatarInitials` (mobile).
 */

/** Split on whitespace AND separator punctuation (hyphen = boundary). */
const WORD_BOUNDARY = /[\s\-–—_/]+/;

/** Everything that isn't a letter, in any script. */
const NON_LETTERS = /[^\p{L}]+/gu;

export function avatarInitials(name: string | null | undefined): string {
  const words = (name ?? "")
    .split(WORD_BOUNDARY)
    .map((w) => w.replace(NON_LETTERS, ""))
    .filter(Boolean);

  if (words.length === 0) return "?";
  if (words.length === 1) {
    // Single alphabetic word — first two letters (or the single letter
    // for a 1-char word). "Alex" → "AL", "A" → "A".
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}
