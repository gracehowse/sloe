/**
 * Recipe-detail layout helpers — shared between
 * `src/app/components/RecipeDetail.tsx` (web) and
 * `apps/mobile/app/recipe/[id].tsx` (mobile).
 *
 * 2026-04-30 ui-product-designer audit (v2): collapsed the clunky
 * "by emthenutritionist / Lunch / Prep · Cook · Servings / kcal /
 * Fits your day" stack into a single subtitle row, a compact (or
 * hidden-when-empty) time-stats row, and a fits-your-day verdict
 * fused INTO the calorie hero.
 *
 * 2026-05-01 v3 redesign: the kcal "hero card" remained the visual
 * weight centre of the screen even after v2 — competing with the
 * title and pushing the macro tiles below the fold. v3:
 *   - kcal becomes an inline `kcal` part of the subtitle row (key
 *     ordered slot · serves · kcal · author)
 *   - the bordered kcal hero card is removed entirely
 *   - macro tiles become the visual hero (bigger numbers, the only
 *     coloured surface above the fold)
 *   - "Fits your day" verdict drops to a single text line directly
 *     below the macro tiles (no card, no pill background)
 *
 * 2026-05-02 v4 polish (recipe-detail-tiles-and-kcal): user feedback
 * flagged the v3 inline kcal as still buried ("cals need to be
 * clearer"). v4:
 *   - kcal moves to its own dedicated 17-pt headline line directly
 *     under the title ("329 kcal · per portion") — its own surface,
 *     not a bold-styled separator-joined word in the meta row
 *   - call sites no longer pass `kcal` to composeSubtitleParts; the
 *     helper still accepts the arg (and drops the token when omitted
 *     / null / 0) so older fixtures keep working, but production
 *     subtitles render slot · serves · by only
 *   - macro tiles switch from a flex-wrap layout (which left fiber
 *     alone on row 2 at half-width) to a 4-up layout — `grid grid-
 *     cols-4` on web, `flex: 1` (with `flexWrap` preserved for narrow
 *     widths and 5–6-tracked-macro users) on mobile
 *
 * These helpers exist so the presentation logic is testable
 * independently of RN/RTL renders.
 */

/** Render the time-stats row only when at least one timing is known. */
export function shouldRenderTimeStats(
  prepMin: number | null | undefined,
  cookMin: number | null | undefined,
): boolean {
  const hasPrep = prepMin != null && prepMin > 0;
  const hasCook = cookMin != null && cookMin > 0;
  return hasPrep || hasCook;
}

/**
 * Compose the subtitle row tokens.
 *
 * v3 ordering, left-to-right: "{slot} · serves N · {kcal} kcal · by {author}"
 *   - Each part is gated on real data (empty/zero parts drop out so
 *     no orphan separators).
 *   - `kcal` was added in v3 so the user can read calories at the same
 *     glance as the title — the bordered hero card is removed.
 *   - Author moved to last so the title row reads as
 *     "what · for whom · how dense", with attribution as a footnote.
 *
 * v4 (2026-05-02): production call sites omit the `kcal` arg — kcal
 * now lives on its own dedicated headline line above the subtitle.
 * The helper still emits a `kcal` part when the caller passes a
 * non-zero value, so fixtures and any future caller wanting the
 * inline form keep working. Default subtitle reads
 * "{slot} · serves N · by {author}".
 */
export function composeSubtitleParts(args: {
  authorLabel: string | null;
  slots: string[] | null | undefined;
  /**
   * Servings to surface in the subtitle. Pass `null` to drop the
   * `serves N` token entirely — needed by callers that have a
   * dedicated servings affordance elsewhere on the screen (e.g.
   * the recipe detail mobile screen, where a stepper card directly
   * under the subtitle is the canonical source of truth and the
   * subtitle token would be a duplicate). Audit C5 (2026-05-05).
   */
  servings: number | null;
  /**
   * Calories per portion. Pass `null` (or 0) when nutrition has not
   * been computed yet — the part is dropped so we never render a
   * confident "0 kcal" subtitle for an un-imported recipe.
   */
  kcal?: number | null;
}): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  if (args.slots && args.slots.length > 0) {
    out.push({ key: "slot", label: args.slots.join(", ").toLowerCase() });
  }
  if (args.servings != null && args.servings > 0) {
    out.push({ key: "serves", label: `serves ${args.servings}` });
  }
  if (args.kcal != null && args.kcal > 0) {
    out.push({ key: "kcal", label: `${Math.round(args.kcal)} kcal` });
  }
  if (args.authorLabel) {
    out.push({ key: "by", label: `by ${args.authorLabel}` });
  }
  return out;
}

/**
 * Compute the "Fits your day" verdict label + tone bucket.
 *
 * v3: extracted so mobile + web render the same line below the macro
 * tiles without copy/colour drift.
 *
 *   ≤ 50%  → fits / success-green
 *   51–99% → over-half / warning-amber
 *   ≥ 100% → over-day / destructive-red
 *
 * Returns null when nutrition is unknown or the target is unset/zero,
 * so callers don't have to guard separately.
 */
export type FitsYourDayTone = "success" | "warning" | "destructive";
export type FitsYourDayVerdict = {
  label: string;
  tone: FitsYourDayTone;
  /** 5-percent-rounded percentage of the daily calorie target. */
  pct: number;
  /** Accessibility-friendly long-form label. */
  a11y: string;
  /** True when the recipe fits in roughly half the day or less. */
  fits: boolean;
};

export function computeFitsYourDayVerdict(args: {
  kcal: number | null | undefined;
  targetCals: number | null | undefined;
}): FitsYourDayVerdict | null {
  const kcal = args.kcal != null ? Math.round(args.kcal) : 0;
  const target = args.targetCals;
  if (kcal <= 0 || target == null || target <= 0) return null;
  const rawPct = (kcal / target) * 100;
  const pct = Math.max(1, Math.round(rawPct / 5) * 5);
  const fits = pct <= 50;
  const overDay = pct >= 100;
  const tone: FitsYourDayTone = fits
    ? "success"
    : overDay
      ? "destructive"
      : "warning";
  const label = fits
    ? `Fits your day · ≈ ${pct}%`
    : overDay
      ? `≈ ${pct}% of your day · over a full day`
      : `≈ ${pct}% of your day`;
  const a11y = fits
    ? `Fits your day. Approximately ${pct} percent of your daily calorie target.`
    : overDay
      ? `Over a full day. Approximately ${pct} percent of your daily calorie target.`
      : `Approximately ${pct} percent of your daily calorie target.`;
  return { label, tone, pct, a11y, fits };
}
