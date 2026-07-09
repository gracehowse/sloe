/**
 * Mobile re-export of the shared weekly-recap helper (Batch 4.11).
 *
 * The recap card on `progress.tsx` uses these directly — no mobile-side
 * duplication, so web and mobile cannot drift.
 */
export {
  buildDigestWeekView,
  buildUsualMealRecapInsight,
  buildWeeklyRecap,
  currentWeekKey,
  formatRecapForShare,
  formatWeekLabel,
  nextRecapFireDate,
  selectClosestToTargetDay,
  shouldShowRecap,
  weekKeyFor,
  type DigestWeekView,
  type UsualMealRecapInsight,
  type WeeklyRecap,
} from "@suppr/nutrition-core/weeklyRecap";
