/**
 * ENG-1387 — client handling for `save_meal_plan` RPC failures.
 *
 * The RPC enforces the Free-tier 1-day plan cap server-side
 * (20260705120000_eng1387_save_meal_plan_free_tier_day_cap.sql):
 * 42501 + a message containing 'limited to 1-day plans'. Normal UI
 * flows never hit it (generation is clamped to 1 day for free users
 * before the call) — it fires on a stale-cached-tier desync or a
 * Pro→Free downgrade holding a multi-day plan. The rejection is
 * atomic, so the user's existing cloud plan is untouched; the alert
 * tells them the edit didn't sync instead of failing silently.
 *
 * 42501 is also the RPC's unauthenticated errcode — the message
 * substring is what distinguishes the tier rejection.
 *
 * Web parity: the same branch in `src/context/AppDataContext.tsx`
 * (toast instead of Alert).
 */
import { Alert } from "react-native";

import {
  isFreeTierPlanCapError,
  type PlanPersistErrorShape,
} from "@suppr/shared/mealPlan/planPersistError";

export { isFreeTierPlanCapError };

export function handlePlanPersistError(
  error: PlanPersistErrorShape,
  context: string,
): void {
  if (isFreeTierPlanCapError(error)) {
    Alert.alert(
      "Plan didn't sync",
      "Free plan is limited to 1-day meal plans. Upgrade to plan your full week.",
    );
    return;
  }
  if (__DEV__) {
    console.warn(`[${context}] save_meal_plan failed:`, error.message);
  }
}
