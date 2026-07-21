/**
 * Descriptive accessibility label for a Discover / Library recipe card.
 *
 * Recipe cards on Discover (web `DiscoverFeed.tsx` + mobile
 * `(tabs)/discover.tsx`) render title + macros + a time chip as visual
 * chrome, but the tappable card itself (a `<button>` on web, a
 * `Pressable` on mobile) carried no accessible name — VoiceOver /
 * screen readers announced an empty "button", so the whole feed was
 * unusable without sight (ENG-1147).
 *
 * This helper builds ONE label string both platforms share, so the
 * announced name can never drift web ↔ mobile. Web passes it as
 * `aria-label`; mobile passes it as `accessibilityLabel`.
 *
 * Shape: `"{title}. Estimated {kcal} calories, {protein}g protein,
 * {carbs}g carbs, {fat}g fat[, {timeLabel}]. View recipe."`
 *
 * "Estimated" is mandatory per the trust posture — nutrition is always
 * estimated, never absolute (see `_project-context.md`). Macros are
 * omitted from the label when a value is null / non-finite rather than
 * announcing a misleading "0g".
 *
 * Mobile-importable: NO `@/` aliases, pure function, no platform APIs
 * (mirrors `displayAttribution.ts` / `recipeSearchMatch.ts`).
 */

export interface RecipeCardAccessibilityInput {
  title: string;
  /** kcal — already rounded by the caller, or raw; we round defensively. */
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  /**
   * Display TOTAL-time string already formatted by the caller (e.g.
   * "25 min") — prep + cook via `totalDuration.ts`'s
   * `formatTotalRecipeDuration` (ENG-1617: this used to be named
   * `cookTime` and callers fed it cook-time-only, so the announced
   * label silently disagreed with the visual card's own prep+cook
   * total. Renamed so a future caller can't repeat that mistake).
   */
  timeLabel?: string | null;
}

function macroPart(label: string, value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded <= 0) return null;
  return `${rounded}g ${label}`;
}

/**
 * Build the screen-reader label for a recipe card. Falls back to a bare
 * "View recipe." when the recipe has no usable title (defensive — every
 * recipe should have a title, but the announced name must never be empty).
 */
export function recipeCardAccessibilityLabel(
  input: RecipeCardAccessibilityInput,
): string {
  const title = input.title?.trim();

  const nutrition: string[] = [];
  if (input.calories != null && Number.isFinite(input.calories)) {
    const kcal = Math.round(input.calories);
    if (kcal > 0) nutrition.push(`estimated ${kcal} calories`);
  }
  const protein = macroPart("protein", input.protein);
  const carbs = macroPart("carbs", input.carbs);
  const fat = macroPart("fat", input.fat);
  for (const part of [protein, carbs, fat]) {
    if (part) nutrition.push(part);
  }

  const timeLabel = input.timeLabel?.trim();

  const segments: string[] = [];
  if (title) segments.push(title);
  if (nutrition.length > 0) {
    segments.push(
      timeLabel ? `${nutrition.join(", ")}, ${timeLabel}` : nutrition.join(", "),
    );
  } else if (timeLabel) {
    segments.push(timeLabel);
  }
  segments.push("View recipe");

  // Each segment reads as its own sentence: capitalise the first letter
  // and terminate with a period for natural screen-reader pacing.
  return segments
    .map((s) => {
      const capped = s.charAt(0).toUpperCase() + s.slice(1);
      return capped.endsWith(".") ? capped : `${capped}.`;
    })
    .join(" ");
}
