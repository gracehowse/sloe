import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Alert } from "react-native";

import { supabase } from "@/lib/supabase";
import { listPlanTemplates } from "@suppr/nutrition-core/planTemplatesClient";
import type { PlanTemplate } from "@suppr/nutrition-core/planTemplates";

type UsePlannerTemplatesParams = {
  userId: string | null;
};

export type UsePlannerTemplatesResult = {
  templatesOpen: boolean;
  setTemplatesOpen: Dispatch<SetStateAction<boolean>>;
  planTemplates: PlanTemplate[];
  setPlanTemplates: Dispatch<SetStateAction<PlanTemplate[]>>;
  templatesLoading: boolean;
};

/**
 * ENG-1631 (Planner extract, slice 1) — the plan-templates sheet's loading
 * state cluster: `templatesOpen` (sheet visibility), `planTemplates` (the
 * fetched list), `templatesLoading`, and a private retry counter
 * (`templatesLoadAttempt`) backing the "Try again" button on a failed
 * fetch. Extracted verbatim from `planner.tsx` (Batch 3.10 / P2-40).
 *
 * ## Why this cluster
 *
 * Same shape as the two TodayScreen precedents (`useTodayWeeklyCheckin`
 * slice 1, `useTodayFasting` slice 2): a self-contained concern — 4
 * `useState` + 1 fetch effect — consumed by exactly one render site
 * (`<PlanTemplatesSheet>` in `planner.tsx`). Of the clusters scanned in
 * `planner.tsx` (this one, the household/shopping-scope pair, the
 * move/swap-meal sheets, the plan-setup chip sheets), this was the
 * lowest-risk: `activeHouseholdId` / `householdMemberCount` fan out into
 * `shoppingScope`, `isSharedHousehold`, and half a dozen downstream
 * consumers (`persistPlan`, `swapMeal`, the shopping-list sync effect, a
 * `servingCount` prop); the move/swap sheets close over `plan` and
 * `persistPlan` directly in their handlers. This cluster's only external
 * input is `userId` and its only external dependency is the
 * `listPlanTemplates` Supabase client helper — nothing else in
 * `planner.tsx` reads `templatesLoadAttempt`.
 *
 * ## What stays in planner.tsx
 *
 * `<PlanTemplatesSheet>`'s JSX and its `onSave` / `onApply` / `onDelete`
 * callbacks stay in `planner.tsx` — they close over `plan`, `setPlan`,
 * `persistPlan`, and `track`, none of which this hook owns, and pulling
 * them in would drag the whole plan-mutation surface along for no
 * reduction in risk (this hook returns data + setters only, consistent
 * with `useTodayFasting`). Those callbacks read `planTemplates` and write
 * it back through the raw `setPlanTemplates` setter this hook exposes —
 * mirrors `setActiveFastStart` in `useTodayFasting`: direct external
 * hydration/mutation via the raw setter is the established pattern for
 * this decomposition, not a gap. `setTemplatesOpen` is exposed the same
 * way: the sheet's `onClose` prop and the "Apply" alert's success path
 * both close the sheet from outside the hook.
 *
 * ## Failure modes
 *
 * - The fetch only runs while the sheet is open (`templatesOpen`) and a
 *   user is signed in (`userId`) — matches pre-extraction gating exactly,
 *   so a signed-out user never fires a doomed query.
 * - The `cancelled` flag guards both the success and `finally` branches,
 *   so a fast open→close→open doesn't let a stale response clobber a
 *   newer request's loading state.
 * - Network-shaped errors (matching `/network|fetch|offline/i`) get a
 *   friendlier message than the raw Supabase error string; either way the
 *   alert's "Try again" bumps `templatesLoadAttempt`, re-running the
 *   effect with the same `templatesOpen`/`userId`.
 */
export function usePlannerTemplates({
  userId,
}: UsePlannerTemplatesParams): UsePlannerTemplatesResult {
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [planTemplates, setPlanTemplates] = useState<PlanTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  // P2-40 (TestFlight `APU2FBCjLALmugeCLmQ4Ii0`, 2026-04-25): generic
  // "Could not load templates" toast was a dead end — no retry, no
  // explanation. Retry counter so the alert gives the user a button to
  // try again, plus a friendlier explanation when the error is
  // offline-shaped. Private to this hook — nothing outside reads it.
  const [templatesLoadAttempt, setTemplatesLoadAttempt] = useState(0);

  useEffect(() => {
    if (!templatesOpen || !userId) return;
    let cancelled = false;
    setTemplatesLoading(true);
    listPlanTemplates(supabase, userId)
      .then(({ templates, error }) => {
        if (cancelled) return;
        if (error) {
          const friendly = String(error).match(/network|fetch|offline/i)
            ? "Couldn't reach Sloe. Check your connection and try again."
            : `Could not load templates: ${error}`;
          Alert.alert("Templates", friendly, [
            { text: "Cancel", style: "cancel", onPress: () => setTemplatesOpen(false) },
            { text: "Try again", onPress: () => setTemplatesLoadAttempt((n) => n + 1) },
          ]);
          return;
        }
        setPlanTemplates(templates);
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [templatesOpen, userId, templatesLoadAttempt]);

  return {
    templatesOpen,
    setTemplatesOpen,
    planTemplates,
    setPlanTemplates,
    templatesLoading,
  };
}
