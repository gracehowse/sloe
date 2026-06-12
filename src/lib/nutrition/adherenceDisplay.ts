/**
 * adherenceDisplay — shared, pure formatter for the Progress headline
 * adherence figure (the `ProgressHeroMetric` ring centre-number and the
 * `ProgressAverageAdherence` big-number card).
 *
 * Decision spec `adherence_over_display` (product-lead, 2026-06-12,
 * audit P1-3 carried). Headline adherence above the 110% tolerance band
 * is BAND-INVERTED: it stops claiming to be "adherence" (you cannot be
 * "111% adherent" — you adhered, then exceeded) and reads as an
 * OVERSHOOT instead. The number the user sees over-target is the
 * overshoot (`pct − 100`), not the inflated total, so a bigger number
 * can never be misread as a better score.
 *
 * | Band       | Condition         | Number    | Suffix    | Label        | Tone    |
 * |------------|-------------------|-----------|-----------|--------------|---------|
 * | On target  | 90 ≤ pct ≤ 110    | pct       | `%`       | On target    | success |
 * | Under      | pct < 90          | pct       | `%`       | Under target | success |
 * | Over       | pct > 110         | pct − 100 | `% over`  | Over target  | warning |
 *
 * Concrete renders:
 *   - avg 82%  → "82%"      · "Under target"
 *   - avg 97%  → "97%"      · "On target"
 *   - avg 105% → "105%"     · "On target"   (100–110 stays raw — no jarring "1% over" at 101%)
 *   - avg 111% → "11% over" · "Over target" (never "111%")
 *
 * Body-neutral by construction: "Over target" is a directional fact in
 * the same register as "Under target" — no "too much", no "exceeded your
 * limit", no calorie-shaming verb (written under the diversity-inclusion
 * constraint). The amber (warning) tone for the OVER band matches the
 * existing macro-bar over treatment — it is NOT the destructive-red ring
 * carve-out.
 *
 * IMPORTANT: this is a PRESENTATION-layer helper. The raw uncapped
 * `adherencePct` in `progressRangeStats.ts` is left untouched (it is a
 * data value; display owns presentation). The two over-target render
 * sites gate the NEW (over) branch behind the `adherence_over_display`
 * feature flag and fall back to today's raw-`{pct}%` behaviour in the
 * `else`. The ≤110% path is IDENTICAL in both branches, so a flag
 * flicker can never change a healthy user's number.
 *
 * Shared so web (`@/lib/nutrition/adherenceDisplay`) and mobile
 * (`@suppr/shared/nutrition/adherenceDisplay`) read identical figures.
 * Pinned by `tests/unit/adherenceDisplay.test.ts`.
 */

/** Upper bound of the "On target" tolerance band — matches the ring's
 *  existing 90–110% tone band, so the flip to "% over" copy triggers
 *  only ABOVE 110%, not at 101%. */
export const ADHERENCE_ON_TARGET_MAX_PCT = 110;
/** Lower bound of the "On target" tolerance band. */
export const ADHERENCE_ON_TARGET_MIN_PCT = 90;

export type AdherenceTone = "on" | "under" | "over";

export interface AdherenceHeadline {
  /** The number to print (e.g. `97`, `82`, or the overshoot `11`). */
  value: number;
  /** Suffix printed after `value` — `"%"` for on/under, `"% over"` for over. */
  suffix: string;
  /**
   * The word after the unit on the OVER band (`"over"`), `null` otherwise.
   * For render sites whose design splits the headline typographically
   * (big `{value}%` + a smaller qualifier tag) — so the copy still comes
   * from this contract, never re-hardcoded at the site (audit review m2).
   */
  qualifier: string | null;
  /** Supporting line copy — `"On target" | "Under target" | "Over target"`. */
  label: string;
  /** Band tone — drives colour: `on`/`under` → success (sage); `over` → warning (amber). */
  tone: AdherenceTone;
}

/**
 * Band-inverted headline for the over-target display (`adherence_over_display`
 * ON). Returns `null` when `adherencePct` is `null` — the caller renders its
 * own empty/score-builds state, never a fabricated number.
 *
 * Render sites print `{value}{suffix}` (e.g. `"97%"`, `"11% over"`) and use
 * `label`/`tone` for the supporting line + colour.
 */
export function formatAdherenceHeadline(
  adherencePct: number | null,
): AdherenceHeadline | null {
  if (adherencePct == null || !Number.isFinite(adherencePct)) return null;
  // Round defensively — `progressRangeStats` already rounds, but a future
  // caller might pass a raw ratio; keep the helper self-consistent.
  const pct = Math.round(adherencePct);

  if (pct > ADHERENCE_ON_TARGET_MAX_PCT) {
    // Over (>110%): flip meaning to the overshoot magnitude. `pct − 100`
    // is small-when-good, so it cannot be misread as an achievement.
    return {
      value: pct - 100,
      suffix: "% over",
      qualifier: "over",
      label: "Over target",
      tone: "over",
    };
  }
  if (pct < ADHERENCE_ON_TARGET_MIN_PCT) {
    return { value: pct, suffix: "%", qualifier: null, label: "Under target", tone: "under" };
  }
  // On target (90–110, inclusive of the 100–110 raw band).
  return { value: pct, suffix: "%", qualifier: null, label: "On target", tone: "on" };
}
