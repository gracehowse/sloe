/**
 * formatIngredientAmount — defensive amount + unit renderer for recipe
 * ingredient rows.
 *
 * Bug it solves (2026-05-02):
 *   USDA / FatSecret / Edamam portion labels are sometimes already a
 *   compound phrase ("1 breast", "1 medium (182g)", "1 cup sliced").
 *   When the verify path persists `unit = portion.label`, the recipe
 *   detail render template `${amount} ${unit}` produces duplicated
 *   tokens like "1 1 breast" or "1 1 medium (182g)".
 *
 *   The clean fix is upstream (don't store amount-prefixed labels in
 *   `unit`), but in-flight rows with that shape already exist in user
 *   recipes and we don't want to ship a destructive backfill. This
 *   formatter dedupes at render time so the historical rows render
 *   cleanly and the new write path can keep the same shape.
 *
 * Behaviour:
 *   - amount=1, unit="breast"           → "1 breast"
 *   - amount=1, unit="1 breast"         → "1 breast"        (dedupe)
 *   - amount=2, unit="2 cups"           → "2 cups"          (dedupe)
 *   - amount=1, unit="1 medium (182g)"  → "1 medium (182g)" (dedupe)
 *   - amount=1, unit=""                 → "1"
 *   - amount="", unit="cup"             → "cup"
 *   - amount=null, unit=null            → ""
 *   - amount="1 breast", unit=""        → "1 breast"        (no-op)
 *
 * Cross-platform: shared lib so web `RecipeDetail.tsx` and mobile
 * `apps/mobile/app/recipe/[id].tsx` use identical formatting.
 */

/**
 * Format a numeric amount + unit string into a single display token.
 * `amount` accepts number | string | null so both rendering paths
 * (mobile passes `number`, web passes a `parseFloat(...)`-friendly
 * string) can share this helper without coercion at the call site.
 */
export function formatIngredientAmountUnit(
  amount: number | string | null | undefined,
  unit: string | null | undefined,
): string {
  const u = (unit ?? "").trim();
  // Coerce amount to a clean string. Numbers render without trailing
  // ".0" so "1" not "1.0". Strings keep whatever the caller passed.
  let a: string;
  if (amount == null) {
    a = "";
  } else if (typeof amount === "number") {
    if (!Number.isFinite(amount)) {
      a = "";
    } else {
      const rounded = Math.round(amount * 100) / 100;
      a = Number.isInteger(rounded) ? String(rounded) : String(rounded);
    }
  } else {
    a = String(amount).trim();
  }

  if (!a && !u) return "";
  if (!u) return a;
  if (!a) return u;

  // Dedupe whole-string match: amount = "1 breast", unit = "1 breast".
  if (a === u) return a;

  // Dedupe when the unit string already starts with the amount token —
  // e.g. amount="1", unit="1 breast" → return unit alone.
  // Compare case-insensitively because USDA labels mix case.
  const aLower = a.toLowerCase();
  const uLower = u.toLowerCase();
  if (uLower === aLower || uLower.startsWith(`${aLower} `)) {
    return u;
  }

  // Dedupe when the amount string already ends with the unit token —
  // e.g. amount="1 breast", unit="breast" → return amount alone.
  if (aLower === uLower || aLower.endsWith(` ${uLower}`)) {
    return a;
  }

  return `${a} ${u}`;
}
