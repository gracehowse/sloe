/**
 * Discover "Quick weeknight" section (Sloe v3 Block 6, ENG-1225).
 *
 * Surfaces fast recipes that otherwise sink in a photo-first feed — quick
 * (≤30 min total), real-calorie, non-imported — rendered as dense NO-PHOTO tint
 * cards (the no-photo treatment is the card STYLE, not a data filter: live
 * recipes resolve stock photos, so a `!photo` filter would empty the section).
 * Mirrors the prototype `.w-rgrid` / `.w-rcard` (`Sloe-App.html` L7570-7576).
 *
 * Shared web↔mobile so the two platforms can't drift on the threshold or cap —
 * the same contract as `libraryShelves` / `planWeekStatus`. Behind the
 * `sloe_v3_discover_editorial` flag at the call site.
 */
import { isQuick, type LibraryFilterRecipe } from "../recipes/libraryFilters";

/** Max cards in the Quick weeknight section. */
export const QUICK_WEEKNIGHT_CAP = 6;

/** Narrow shape the section needs — both RecipeCard types are supersets. */
export interface QuickWeeknightRecipe extends LibraryFilterRecipe {
  calories: number;
  /** Two-plane origin; imported stubs are excluded (editorial section). */
  contentOrigin?: "first_party" | "imported_stub" | "claimed";
}

/**
 * Pick the (capped) quick-weeknight recipes from a Discover feed list: quick
 * (≤30 min), a real positive calorie count, and not an imported stub.
 */
export function deriveQuickWeeknight<T extends QuickWeeknightRecipe>(
  recipes: readonly T[],
): T[] {
  return recipes
    .filter(
      (r) =>
        isQuick(r) &&
        Number.isFinite(r.calories) &&
        r.calories > 0 &&
        r.contentOrigin !== "imported_stub",
    )
    .slice(0, QUICK_WEEKNIGHT_CAP);
}
