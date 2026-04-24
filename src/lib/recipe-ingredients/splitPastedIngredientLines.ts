/**
 * Split a block of pasted text into one trimmed ingredient line each.
 * Strips common list markers (bullets, numeric prefixes).
 */
export function splitPastedIngredientLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^[-•*]\s*/, "").replace(/^\d+[.)]\s+/, "").trim())
    .filter(Boolean);
}
