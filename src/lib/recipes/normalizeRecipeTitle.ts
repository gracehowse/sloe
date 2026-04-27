/**
 * normalizeRecipeTitle (2026-04-25 polish)
 *
 * Tester feedback: "when recipes import sometimes the title pulls in all caps,
 * it should be fixed on entry to be proper case."
 *
 * The web is full of recipe pages whose schema.org JSON-LD `name` field is
 * stored in ALL CAPS for visual emphasis ("PEANUT LIME CHICKEN BOWL"). When we
 * import, that title flows straight into the DB and renders verbatim across
 * the whole app — Discover cards, Recipe Detail, planner rows. Our brand voice
 * uses Title Case; ALL CAPS reads as broken or spammy.
 *
 * Heuristic:
 *   - If the input contains any lowercase letter → leave alone. The author
 *     made a deliberate casing choice (e.g. "Banh Mi" stays "Banh Mi";
 *     "iPhone-friendly Pasta" stays as-is).
 *   - If every alphabetic character is uppercase → title-case it word-by-word
 *     using a small stop-word list ("the", "of", "and", etc.) so the result
 *     reads naturally.
 *   - First and last words are always capitalised regardless of stop-word
 *     status (so "OF MICE AND MEN" → "Of Mice and Men", not "of Mice and Men").
 *
 * Returns a trimmed string. Empty / null / undefined → "Untitled recipe" so
 * downstream code never sees a falsy title.
 */

const STOP_WORDS: ReadonlySet<string> = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "into",
  "nor", "of", "on", "or", "so", "the", "to", "with", "yet",
]);

function titleCaseWord(word: string, isFirstOrLast: boolean): string {
  if (!word) return word;
  // Preserve hyphenated compounds: "BLACK-BEAN" → "Black-Bean".
  if (word.includes("-")) {
    return word
      .split("-")
      .map((part) => titleCaseWord(part, isFirstOrLast))
      .join("-");
  }
  const lower = word.toLowerCase();
  if (!isFirstOrLast && STOP_WORDS.has(lower)) return lower;
  // Capitalise first letter, lowercase the rest. Handles "DON'T" → "Don't".
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function normalizeRecipeTitle(input: string | null | undefined): string {
  if (!input) return "Untitled recipe";
  const trimmed = input.trim();
  if (!trimmed) return "Untitled recipe";
  // Has any lowercase letter → respect the author's casing.
  if (/[a-z]/.test(trimmed)) return trimmed;
  // No lowercase → title-case each word.
  const words = trimmed.split(/(\s+)/); // keep whitespace tokens
  const wordIndices: number[] = [];
  words.forEach((w, i) => {
    if (w.trim().length > 0) wordIndices.push(i);
  });
  if (wordIndices.length === 0) return trimmed;
  const firstIdx = wordIndices[0]!;
  const lastIdx = wordIndices[wordIndices.length - 1]!;
  return words
    .map((word, i) => {
      if (!word.trim()) return word; // whitespace tokens pass through
      return titleCaseWord(word, i === firstIdx || i === lastIdx);
    })
    .join("");
}
