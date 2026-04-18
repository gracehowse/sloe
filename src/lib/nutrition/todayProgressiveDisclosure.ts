/**
 * Today-screen progressive disclosure gates (Audit M4, 2026-04-18).
 *
 * The Today screen previously stacked ten cards top-to-bottom on first run,
 * making it hostile to brand-new users. This module owns the single-source-of-
 * truth visibility rules so web and mobile cannot drift.
 *
 * No card is removed. Each gate returns `true` once the user has enough
 * state to justify the surface, and the result is intentionally additive —
 * a returning user who has ever used the feature always sees it.
 *
 * Rules (per audit M4):
 *  - Hydration card: visible once the user has a non-zero water target OR
 *    has logged any water (either directly via quick-add chips or implicitly
 *    via a logged meal that carries `waterMl`).
 *  - Steps & activity card: visible once Apple Health / Google Fit has
 *    synced at least once (activity burn map OR steps map non-empty). Until
 *    then a small "Connect health" link is shown in its place.
 *  - Adaptive TDEE hint: visible once confidence is medium/high OR the user
 *    has ≥ 14 logged days — same threshold encoded in `getEffectiveTDEE`.
 *
 * Quick Add panel collapse is handled by a separate persistence key
 * (`suppr-quick-add-collapsed-v1`) because it's a user-controlled toggle,
 * not a state-derived gate.
 */

/** Minimum number of distinct logged days for the Adaptive TDEE hint to surface. */
export const ADAPTIVE_TDEE_HINT_MIN_LOGGED_DAYS = 14;

/** Profile fields needed to decide whether the Adaptive TDEE hint is relevant. */
export interface AdaptiveTdeeHintGateInput {
  adaptiveTdee: number | null | undefined;
  adaptiveTdeeConfidence: string | null | undefined;
  loggedDayCount: number;
}

/**
 * Hydration & stimulants card gate.
 *
 * Visible when:
 *  - the user has a non-zero water target, OR
 *  - they have logged any water today via quick-add, OR
 *  - any logged meal on the selected day carries `waterMl`, OR
 *  - they have logged caffeine or alcohol (stimulants imply they intended to
 *    use the card even if they set no water target).
 *
 * The map inputs are the same Record<dayKey, number> shapes used by the host.
 */
export function isHydrationCardVisible(input: {
  waterTargetMl: number;
  extraWaterByDay: Record<string, number>;
  waterFromMealsMl: number;
  extraCaffeineByDay: Record<string, number>;
  extraAlcoholGByDay: Record<string, number>;
}): boolean {
  const { waterTargetMl, extraWaterByDay, waterFromMealsMl, extraCaffeineByDay, extraAlcoholGByDay } = input;
  if (Number.isFinite(waterTargetMl) && waterTargetMl > 0) return true;
  if (waterFromMealsMl > 0) return true;
  if (hasAnyPositiveValue(extraWaterByDay)) return true;
  if (hasAnyPositiveValue(extraCaffeineByDay)) return true;
  if (hasAnyPositiveValue(extraAlcoholGByDay)) return true;
  return false;
}

/**
 * Steps & activity card gate.
 *
 * Visible once at least one Health-Sync-backed map has data. We do NOT check
 * the card's own presentational state — only the raw evidence that a sync
 * has ever completed (activity burn OR steps recorded for any day).
 */
export function isStepsCardVisible(input: {
  stepsByDay: Record<string, number>;
  activityBurnByDay: Record<string, number>;
}): boolean {
  if (hasAnyPositiveValue(input.stepsByDay)) return true;
  if (hasAnyPositiveValue(input.activityBurnByDay)) return true;
  // Some sync paths record a zero to mark "synced today" — we still count
  // that as evidence the user has connected Health at least once.
  if (Object.keys(input.stepsByDay).length > 0) return true;
  if (Object.keys(input.activityBurnByDay).length > 0) return true;
  return false;
}

/**
 * Adaptive TDEE hint gate.
 *
 * Matches the `getEffectiveTDEE` threshold: adaptive TDEE is trusted at
 * medium/high confidence. Below that, only reveal the hint once the user
 * has logged ≥ 14 days (enough data that the adaptive engine will converge
 * soon; showing the hint earlier is noise).
 */
export function isAdaptiveTdeeHintVisible(input: AdaptiveTdeeHintGateInput): boolean {
  const tdee = typeof input.adaptiveTdee === "number" ? input.adaptiveTdee : null;
  const confidence = typeof input.adaptiveTdeeConfidence === "string" ? input.adaptiveTdeeConfidence : null;
  if (tdee != null && tdee > 0 && (confidence === "medium" || confidence === "high")) {
    return true;
  }
  const days = Number(input.loggedDayCount);
  if (Number.isFinite(days) && days >= ADAPTIVE_TDEE_HINT_MIN_LOGGED_DAYS) return true;
  return false;
}

/** Storage key for the Quick Add panel collapsed preference. Same on web + mobile. */
export const QUICK_ADD_COLLAPSED_STORAGE_KEY = "suppr-quick-add-collapsed-v1";

/**
 * Parses a stored Quick Add collapsed preference. Defaults to `true`
 * (collapsed) so first-run users see a single Quick add CTA rather than the
 * 4-tab panel.
 */
export function parseQuickAddCollapsed(raw: string | null | undefined): boolean {
  if (raw === "false") return false;
  if (raw === "true") return true;
  return true;
}

/** Serialises the Quick Add collapsed preference for storage. */
export function serializeQuickAddCollapsed(collapsed: boolean): string {
  return collapsed ? "true" : "false";
}

function hasAnyPositiveValue(map: Record<string, number> | null | undefined): boolean {
  if (!map) return false;
  for (const key of Object.keys(map)) {
    const v = map[key];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return true;
  }
  return false;
}
