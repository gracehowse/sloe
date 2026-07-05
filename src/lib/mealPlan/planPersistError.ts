/**
 * ENG-1387 — shared detection for the `save_meal_plan` free-tier
 * day-cap rejection.
 *
 * The RPC (20260705120000_eng1387_save_meal_plan_free_tier_day_cap.sql)
 * enforces the Free = 1-day plan cap server-side and rejects with
 * errcode 42501 and a message containing the fragment below. 42501 is
 * also the RPC's unauthenticated errcode, so the message fragment —
 * not the code alone — identifies the tier rejection.
 *
 * Consumed by web (`src/context/AppDataContext.tsx`, toast) and mobile
 * (`apps/mobile/lib/mealPlanErrors.ts` via `@suppr/shared`, alert).
 * The unit test pins this fragment against the migration SQL so the
 * two sides cannot drift apart.
 */

export const FREE_TIER_PLAN_CAP_MESSAGE_FRAGMENT = "limited to 1-day plans";

export interface PlanPersistErrorShape {
  code?: string;
  message?: string;
}

export function isFreeTierPlanCapError(
  error: PlanPersistErrorShape | null | undefined,
): boolean {
  return (
    error?.code === "42501" &&
    (error.message ?? "").includes(FREE_TIER_PLAN_CAP_MESSAGE_FRAGMENT)
  );
}
