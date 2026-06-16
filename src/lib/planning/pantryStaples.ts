/**
 * ENG-1051 — pantry/staples suppress-list for shopping-list generation.
 *
 * Suppresses ingredients the user always keeps on hand. This is NOT an
 * inventory tracker — it only filters generated shopping rows.
 */

export type PantryStaplesJson = string[];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Normalise a staple or ingredient name for matching. */
export function normalizePantryToken(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Parse `profiles.pantry_staples` jsonb. */
export function parsePantryStaples(raw: unknown): readonly string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const t = item.trim();
    if (t.length > 0) out.push(t);
  }
  return out;
}

/**
 * True when `ingredientName` matches a pantry staple (word-boundary aware).
 * Longer staples are checked first so "olive oil" wins over "oil".
 */
export function isPantryStapleMatch(
  ingredientName: string,
  staples: readonly string[],
): boolean {
  const norm = normalizePantryToken(ingredientName);
  if (!norm || staples.length === 0) return false;

  const sorted = [...staples]
    .map((s) => normalizePantryToken(s))
    .filter((s) => s.length > 0)
    .sort((a, b) => b.length - a.length);

  for (const staple of sorted) {
    if (norm === staple) return true;
    const re = new RegExp(`\\b${escapeRegExp(staple)}\\b`, "i");
    if (re.test(norm)) return true;
  }
  return false;
}

/** Remove shopping rows whose names match any pantry staple. */
export function filterShoppingItemsByPantry<T extends { name: string }>(
  items: readonly T[],
  staples: readonly string[],
): T[] {
  if (staples.length === 0) return [...items];
  return items.filter((item) => !isPantryStapleMatch(item.name, staples));
}

/** Append a staple if not already present (case-insensitive). */
export function appendPantryStaple(
  staples: readonly string[],
  name: string,
): readonly string[] {
  const trimmed = name.trim();
  if (!trimmed) return staples;
  if (staples.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
    return staples;
  }
  return [...staples, trimmed];
}
