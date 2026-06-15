/**
 * resolveMaintenance — single source of truth for the "Maintenance"
 * number shown across Today and Progress on both platforms.
 *
 * Two numbers used to fight on screen:
 *   - Today's Activity Bonus tile showed the static Mifflin × activity
 *     multiplier (e.g. 1,675) labelled "Maintenance".
 *   - Progress showed the adaptive TDEE (e.g. 1,777) labelled "Your TDEE".
 * Two numbers, two labels, no explanation. TestFlight
 * `ADFYpDgEEb0QH-j3BXshPTo` (build 10, 2026-04-18).
 *
 * Resolution rules (shared across web + mobile, both surfaces):
 *   1. Prefer adaptive TDEE when `adaptive_tdee_confidence` is
 *      `"medium"` or `"high"` AND `adaptive_tdee > 0` AND the value is
 *      not stale (> `ADAPTIVE_STALE_DAYS` since `adaptive_tdee_updated_at`).
 *      A stale adaptive number is silently wrong after a long gap in
 *      logging / weigh-ins — fall back to the formula until it refreshes.
 *   2. Otherwise fall back to the static Mifflin-St Jeor formula using
 *      the user's stored sex / weight / height / age / activity level.
 *   3. When the formula inputs are incomplete (any of sex / weight /
 *      height / age missing) the resolver returns `null` so callers can
 *      omit the tile entirely — we never fabricate a maintenance number.
 *
 * Callers:
 *   - `src/app/components/NutritionTracker.tsx` (web Today)
 *   - `apps/mobile/app/(tabs)/index.tsx` (mobile Today — bonus baseline + tile)
 *   - `apps/mobile/app/burn-detail.tsx` (mobile Activity Bonus breakdown)
 *   - `src/app/components/ProgressDashboard.tsx` (web Progress)
 *   - `apps/mobile/app/(tabs)/progress.tsx` (mobile Progress)
 *
 * Structural parity pinned by
 * `tests/unit/resolveMaintenance.test.ts` +
 * `apps/mobile/tests/unit/weightChartRangeFilter.test.ts` (parity-of-
 * import style).
 */

import {
  calculateTDEE,
  type ActivityLevel,
  type Sex,
} from "./tdee";

/**
 * Adaptive values older than this many days are treated as stale and
 * replaced with the formula. Matches the product-memory note: a user who
 * stops weighing in or logging for two weeks should not see a calcified
 * adaptive number dictating Today.
 */
export const ADAPTIVE_STALE_DAYS = 14;

export type MaintenanceSource = "measured" | "adaptive" | "formula";

export type MaintenanceConfidence = "low" | "medium" | "high" | null;

export interface MaintenanceProfile {
  /** Adaptive TDEE from the energy-balance calculator, or null. */
  adaptive_tdee?: number | null;
  /** Server-assigned confidence ("low" | "medium" | "high"), or null. */
  adaptive_tdee_confidence?: string | null;
  /** ISO timestamp of the last adaptive recompute, or null. */
  adaptive_tdee_updated_at?: string | null;
  /** ENG-1111 — median HealthKit daily burn when wear gate passes. */
  measured_tdee?: number | null;
  measured_tdee_confidence?: string | null;
  measured_tdee_updated_at?: string | null;
  /** Formula inputs. All must be finite + positive for a formula fallback. */
  sex?: Sex | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  age?: number | null;
  /**
   * Retained for call-site compatibility, but intentionally NOT consulted by
   * the formula seed — the bonus-coexisting maintenance number is pinned to
   * sedentary (`MAINTENANCE_SEED_ACTIVITY`) so it stays the lazy-day/NEAT
   * burn and the per-day activity bonus isn't double-counted (survey §4).
   */
  activity_level?: ActivityLevel | null;
}

export interface ResolvedMaintenance {
  /** Maintenance kcal/day, rounded. */
  kcal: number;
  /** Which branch produced `kcal`. Drives copy + badge visibility. */
  source: MaintenanceSource;
  /** Adaptive confidence at the time of resolution. `null` for formula. */
  confidence: MaintenanceConfidence;
  /** The static Mifflin value computed from profile basics. May be `null` when inputs are missing. */
  formulaKcal: number | null;
  /**
   * When the adaptive branch would have won on confidence alone but was
   * rejected because the value is stale. Lets the Progress card surface
   * a gentle "re-weigh to refresh" hint without re-deriving staleness.
   */
  adaptiveRejectedAsStale: boolean;
  /**
   * ENG-1057 — adaptive sat below the sedentary formula (typical when intake
   * is under-logged). We surface the formula as Maintenance instead of an
   * implausible adaptive headline; callers can mention the rejected value.
   */
  adaptiveRejectedBelowFormula: boolean;
  /** Raw adaptive kcal when `adaptiveRejectedBelowFormula` is true. */
  rejectedAdaptiveKcal: number | null;
}

function isFinitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function normaliseConfidence(raw: unknown): MaintenanceConfidence {
  if (raw === "low" || raw === "medium" || raw === "high") return raw;
  return null;
}

/**
 * The activity level the formula seed is computed at. This is the maintenance
 * number that COEXISTS WITH THE PER-DAY ACTIVITY BONUS: Today derives
 * `maintenanceKcal` from this resolver and then `computeActivityBonusKcal`
 * adds workout burn on top via the projected-EOD model. In Suppr's add-back
 * architecture (NEAT base + per-day exercise bonus), maintenance must be the
 * **lazy-day / NEAT** burn — i.e. the *sedentary* (1.2) formula — or the
 * activity the user's profile multiplier already bakes in gets counted twice
 * (once in the seed, once in the bonus). See the TDEE methodology survey §4
 * "is maintenance the lazy-day burn or the average burn?" and its boxed
 * latent-bug flag (`docs/ux/research/2026-06-10-tdee-methodology-survey.md`)
 * and the decision `docs/decisions/2026-06-10-adaptive-tdee-gating.md`.
 *
 * Note: `profile.activity_level` is intentionally NOT consulted here. Other
 * consumers of the profile activity level (onboarding seed, the static
 * `calculateTDEE` budget path, the Progress "how this works" explainer) keep
 * using the user's chosen multiplier — only the bonus-coexisting maintenance
 * seed is pinned to sedentary.
 */
export const MAINTENANCE_SEED_ACTIVITY: ActivityLevel = "sedentary";

function computeFormulaKcal(profile: MaintenanceProfile): number | null {
  if (
    !profile.sex ||
    !isFinitePositive(profile.weight_kg) ||
    !isFinitePositive(profile.height_cm) ||
    !isFinitePositive(profile.age)
  ) {
    return null;
  }
  return Math.round(
    calculateTDEE(
      profile.sex,
      profile.weight_kg,
      profile.height_cm,
      profile.age,
      MAINTENANCE_SEED_ACTIVITY,
    ),
  );
}

/**
 * `now` is injectable so tests can freeze time without touching vi.useFakeTimers.
 */
export function resolveMaintenance(
  profile: MaintenanceProfile,
  opts: { now?: Date; enableMeasured?: boolean } = {},
): ResolvedMaintenance | null {
  const now = opts.now ?? new Date();
  const confidence = normaliseConfidence(profile.adaptive_tdee_confidence);
  const formulaKcal = computeFormulaKcal(profile);

  const measuredConfidence = normaliseConfidence(profile.measured_tdee_confidence);
  const measuredCandidate = isFinitePositive(profile.measured_tdee)
    ? profile.measured_tdee
    : null;
  const measuredConfident =
    measuredConfidence === "medium" || measuredConfidence === "high";

  if (opts.enableMeasured && measuredCandidate != null && measuredConfident) {
    const measuredUpdatedAt = profile.measured_tdee_updated_at
      ? new Date(profile.measured_tdee_updated_at)
      : null;
    const measuredStale =
      measuredUpdatedAt != null &&
      Number.isFinite(measuredUpdatedAt.getTime()) &&
      now.getTime() - measuredUpdatedAt.getTime() > ADAPTIVE_STALE_DAYS * 86_400_000;
    if (!measuredStale) {
      return {
        kcal: Math.round(measuredCandidate),
        source: "measured",
        confidence: measuredConfidence,
        formulaKcal,
        adaptiveRejectedAsStale: false,
        adaptiveRejectedBelowFormula: false,
        rejectedAdaptiveKcal: null,
      };
    }
  }

  const adaptiveCandidate = isFinitePositive(profile.adaptive_tdee)
    ? profile.adaptive_tdee
    : null;
  const confident = confidence === "medium" || confidence === "high";

  let adaptiveRejectedAsStale = false;
  if (adaptiveCandidate != null && confident) {
    const updatedAt = profile.adaptive_tdee_updated_at
      ? new Date(profile.adaptive_tdee_updated_at)
      : null;
    const stale =
      updatedAt != null &&
      Number.isFinite(updatedAt.getTime()) &&
      now.getTime() - updatedAt.getTime() > ADAPTIVE_STALE_DAYS * 86_400_000;
    if (stale) {
      adaptiveRejectedAsStale = true;
    } else {
      const adaptiveKcal = Math.round(adaptiveCandidate as number);
      // ENG-1057: under-logged users can drive adaptive below the sedentary
      // formula. Showing that as "Maintenance" breaks trust and poisons the
      // explainer chain; fall back to formula until intake quality recovers.
      if (formulaKcal != null && adaptiveKcal < formulaKcal) {
        return {
          kcal: formulaKcal,
          source: "formula",
          confidence,
          formulaKcal,
          adaptiveRejectedAsStale: false,
          adaptiveRejectedBelowFormula: true,
          rejectedAdaptiveKcal: adaptiveKcal,
        };
      }
      return {
        kcal: adaptiveKcal,
        source: "adaptive",
        confidence,
        formulaKcal,
        adaptiveRejectedAsStale: false,
        adaptiveRejectedBelowFormula: false,
        rejectedAdaptiveKcal: null,
      };
    }
  }

  if (formulaKcal == null) return null;
  return {
    kcal: formulaKcal,
    source: "formula",
    confidence,
    formulaKcal,
    adaptiveRejectedAsStale,
    adaptiveRejectedBelowFormula: false,
    rejectedAdaptiveKcal: null,
  };
}

/**
 * One-line popover copy shared across Today's Activity Bonus card on
 * web + mobile. Stable contract for the info popover (task F-3 §5).
 */
export function buildMaintenancePopoverCopy(resolved: ResolvedMaintenance): string {
  if (resolved.source === "measured") {
    const label = resolved.confidence ?? "medium";
    return `Maintenance is the calories you'd burn in a normal day. Based on your Apple Health burn (${label} confidence).`;
  }
  if (resolved.source === "adaptive") {
    const label = resolved.confidence ?? "medium";
    return `Maintenance is the calories you'd burn in a normal day. Based on your actual intake and weight changes (${label} confidence).`;
  }
  return "Maintenance is the calories you'd burn in a normal day. Formula estimate from your stats and activity level.";
}

/**
 * Action 5 Item 7 (2026-04-19) — single-line "Your maintenance landed
 * at X kcal this week (formula said Y)." for the WeeklyRecapCard.
 *
 * Returns `null` when the line should be suppressed:
 *  - `resolved` is `null` (no maintenance number to show).
 *  - The adaptive branch did not win — i.e. the resolver fell back to
 *    the formula. In that case the resolved value *is* the formula
 *    value, so the line would say "landed at X (formula said X)" which
 *    is not informative.
 *  - `confidence === "low"` — adaptive can't actually win on low
 *    confidence (the resolver rejects it), but we belt-and-braces guard
 *    here so any future relaxation in the resolver doesn't accidentally
 *    surface a low-signal line on the recap.
 *  - `formulaKcal` is `null` (incomplete profile).
 *  - The two values are identical (nothing to compare).
 *
 * Shared by web `weekly-recap-card.tsx` and mobile `WeeklyRecapCard.tsx`
 * so the recap copy can't drift across platforms. Pinned by
 * `tests/unit/maintenanceRecapLine.test.ts`.
 */
export function formatMaintenanceRecapLine(
  resolved: ResolvedMaintenance | null | undefined,
): string | null {
  if (!resolved) return null;
  if (resolved.source !== "adaptive") return null;
  if (resolved.confidence === "low") return null;
  if (resolved.formulaKcal == null) return null;
  if (resolved.kcal === resolved.formulaKcal) return null;
  return `Your maintenance landed at ${resolved.kcal.toLocaleString()} kcal this week (formula said ${resolved.formulaKcal.toLocaleString()}).`;
}
