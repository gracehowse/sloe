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

/**
 * Compose the recipe meta row (`recipes.md` frame §5):
 * `★ rating · time · difficulty · N items`.
 *
 * REAL DATA ONLY — every part is gated on a known value and dropped
 * when unknown (no "0 items", no "— min", no fabricated rating). The
 * caller renders the returned parts joined by " · " so unknown stats
 * leave no orphan separator.
 *
 *   - rating:     shown as "★ 4.6" only when a finite rating in (0, 5]
 *                 is passed. `recipes.rating` is frequently null, so it
 *                 simply doesn't render until a real value exists.
 *   - time:       total prep+cook minutes, formatted "25 min" / "1h 10m"
 *                 via the same `formatRecipeMinutes` rules. Dropped when
 *                 neither time is known.
 *   - difficulty: a TRANSPARENT heuristic from step count (an observable
 *                 property, not a fabricated rating): 1–4 steps = Easy,
 *                 5–8 = Medium, 9+ = Involved. Dropped when step count is
 *                 unknown/zero. Not a nutrition value — a UX nicety.
 *   - items:      ingredient count, "8 items" / "1 item". Dropped at 0.
 */
export type RecipeMetaPartKey = "rating" | "time" | "difficulty" | "items";

export function recipeDifficultyFromSteps(
  stepCount: number | null | undefined,
): "Easy" | "Medium" | "Involved" | null {
  if (stepCount == null || !Number.isFinite(stepCount) || stepCount <= 0) return null;
  if (stepCount <= 4) return "Easy";
  if (stepCount <= 8) return "Medium";
  return "Involved";
}

function formatTotalMinutes(totalMin: number | null | undefined): string | null {
  if (totalMin == null || !Number.isFinite(totalMin) || totalMin <= 0) return null;
  const m = Math.round(totalMin);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

export function composeRecipeMetaParts(args: {
  /** Community average rating in (0, 5], or null/undefined when unknown. */
  rating?: number | null;
  /** Total prep+cook minutes; pass the sum (or null). */
  totalMinutes?: number | null;
  /** Step count — drives the difficulty heuristic. */
  stepCount?: number | null;
  /** Number of ingredient rows. */
  itemCount?: number | null;
}): { key: RecipeMetaPartKey; label: string }[] {
  const out: { key: RecipeMetaPartKey; label: string }[] = [];

  if (
    args.rating != null &&
    Number.isFinite(args.rating) &&
    args.rating > 0 &&
    args.rating <= 5
  ) {
    // One decimal, trimmed (4.0 → "4", 4.55 → "4.6").
    const r = Math.round(args.rating * 10) / 10;
    out.push({ key: "rating", label: `★ ${r % 1 === 0 ? r.toFixed(0) : r.toFixed(1)}` });
  }

  const time = formatTotalMinutes(args.totalMinutes);
  if (time) out.push({ key: "time", label: time });

  const difficulty = recipeDifficultyFromSteps(args.stepCount);
  if (difficulty) out.push({ key: "difficulty", label: difficulty });

  if (args.itemCount != null && Number.isFinite(args.itemCount) && args.itemCount > 0) {
    const n = Math.round(args.itemCount);
    out.push({ key: "items", label: `${n} ${n === 1 ? "item" : "items"}` });
  }

  return out;
}

/**
 * Frame palette for the "Fits your day" payoff chip
 * (`docs/ux/redesign/recipes.md` §315 "Fits-your-day verdict chip").
 *
 * The redesign frame (recipe-detail) specifies a SAGE success chip —
 * `#5E7C5A` text on a 10% sage fill — for the permission moment, with
 * amber tints for over-half / over-a-day. This supersedes the earlier
 * ENG-818 "win amber for the fit chip" treatment for THIS surface: the
 * recipe-detail frame is the source of truth for the chip's colour, and
 * the brand-manager frame chose sage so "this fits your day" reads as a
 * calm green permission signal, not a celebration.
 *
 * Returned as raw hex/rgba so both web (inline style) and mobile
 * (RN style object) consume one source — no per-platform palette drift.
 * `fg` is the text + icon colour; `bg` is the chip fill.
 *
 *   success (≤50% of day)    → sage text on sage-10% fill
 *   warning (51–99%)         → amber text on amber-10% fill
 *   destructive (≥100%)      → amber text on amber-20% fill (frame §325:
 *                              "over" stays amber, deeper fill — NOT
 *                              destructive red; only the calorie ring
 *                              uses red for over-budget)
 */
export type FitsYourDayChipStyle = { fg: string; bg: string };

export function fitsYourDayChipStyle(tone: FitsYourDayTone): FitsYourDayChipStyle {
  switch (tone) {
    case "success":
      // Sage `#5E7C5A` text on a 10% sage fill (frame §315/§323).
      return { fg: "#5E7C5A", bg: "rgba(94, 124, 90, 0.1)" };
    case "warning":
      // Amber `#C9892C` text on a 10% amber fill (frame §324).
      return { fg: "#C9892C", bg: "rgba(201, 137, 44, 0.1)" };
    case "destructive":
      // Frame §325 — "over" stays amber (deeper 20% fill), never red.
      return { fg: "#C9892C", bg: "rgba(201, 137, 44, 0.2)" };
  }
}

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
  // Copy aligned to the recipe-detail frame (`recipes.md` §323–325).
  // Success leads with the permission signal ("Fits your day"); the
  // over-budget tones state the cost honestly without diet-shaming.
  const label = fits
    ? `Fits your day · ${pct}% of today`
    : overDay
      ? `Over your day · ${pct}% of today`
      : `${pct}% of your day`;
  const a11y = fits
    ? `Fits your day. About ${pct} percent of your daily calorie target.`
    : overDay
      ? `This recipe is about ${pct} percent of your daily calorie target — over a full day.`
      : `This recipe takes about ${pct} percent of your daily calorie target.`;
  return { label, tone, pct, a11y, fits };
}
