/**
 * Shared normaliser for recipe `instructions` text.
 *
 * Runs on both read and write paths so the same rules apply whether we're
 * rendering existing DB rows or sanitising fresh user input before insert.
 *
 * Rules (in order):
 *   1. Non-string / null / undefined → `""`.
 *   2. Replace escaped `\n` two-char sequences with real newlines. Some
 *      imports (and user-typed text from the Create Recipe form whose
 *      placeholder historically rendered `\n` literally — TestFlight
 *      `AO4NtyNB`, 2026-04-18) landed with this shape.
 *   3. Replace literal `/n` with a real newline. At least one historical
 *      seed (`AO4NtyNBpP4FJRgq7mCV5cs`) stored newlines this way. Require
 *      leading whitespace to avoid destroying URL paths ("apples/navel"
 *      shouldn't be touched).
 *   4. Collapse any run of 3+ consecutive newlines down to exactly 2
 *      (paragraph break). Protects against messy imported HTML.
 *   5. Trim leading / trailing whitespace on the whole string.
 *
 * Intentionally does NOT split into steps — callers that need an array
 * still run `.split(/\n+/).map(s => s.trim()).filter(Boolean)` after this
 * helper so step parsing stays co-located with the rendering code.
 *
 * Related: TestFlight feedback `AO4NtyNB` — Create Recipe form placeholder
 * taught users to type `\n`; `ACEH_Ilshzp` — imported recipe source card
 * (same 2026-04-19 pass, separate track).
 */
export function normaliseInstructions(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/\\n/g, "\n")
    // Historical seeds stored newlines as a literal "/n". Treat it as a
    // separator only when whitespace-adjacent or at a string boundary,
    // so real URL paths like "apples/navel" are preserved.
    .replace(/\s+\/n\s?/g, "\n")
    .replace(/\/n\s+/g, "\n")
    .replace(/^\/n/, "")
    .replace(/\/n$/, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
