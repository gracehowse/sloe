import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { supabase } from "@/lib/supabase";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import type { MaintenanceConfidence } from "@suppr/nutrition-core/resolveMaintenance";
import { buildWeightRangeStats } from "@suppr/nutrition-core/progressRangeStats";
import {
  buildWeeklyCheckinContent,
  shouldShowWeeklyCheckin,
  type WeeklyCheckinContent,
  type WeeklyCheckinConfidence,
} from "@/lib/weeklyCheckin";
import type { JournalMeal } from "@/lib/nutritionJournal";
import type { NutritionDefaults } from "@/constants/nutritionDefaults";

// Mirrors the local `TrackerMacroTargets` type in TodayScreen.tsx
// (`Pick<NutritionDefaults, "calories" | "protein" | "carbs" | "fat" |
// "fiber">`) — redeclared here rather than imported so this hook doesn't
// take a dependency on the screen file it was extracted from.
type TrackerMacroTargets = Pick<
  NutritionDefaults,
  "calories" | "protein" | "carbs" | "fat" | "fiber"
>;

type WeeklyCheckinWeekData = {
  days: { totals: { calories: number } }[];
  weekAvg: { calories: number };
};

type WeeklyCheckinMaintenance = { formulaKcal: number | null } | null;

type UseTodayWeeklyCheckinParams = {
  userId: string | undefined;
  isToday: boolean;
  /** Currently-open edit-meal modal state, `null` when closed. Used
   *  (together with `params.editMealId`) to suppress the check-in gate
   *  while the user is mid-edit — see the build-45/47 fix documented
   *  on the effect below. */
  editingMeal: JournalMeal | null;
  /** Route params — only `editMealId` is read (deep-link/back-nav return
   *  from `/meal-nutrition` → Edit). Typed as a subset of
   *  `TodayCompositionRoot["params"]` rather than imported so this hook
   *  doesn't take a dependency on the routing param shape. */
  params: { editMealId?: string };
  profileMaintenanceTdeeKcal: number | null;
  profileMaintenanceConfidence: MaintenanceConfidence;
  weekData: WeeklyCheckinWeekData;
  targetCalories: number;
  resolvedMaintenance: WeeklyCheckinMaintenance;
  profileSex: "male" | "female" | "unspecified" | null;
  /**
   * ENG-1585 — `profiles.weight_kg_by_day`, the same map TodayScreen
   * hydrates into `profileWeightKgByDay`. Feeds the real 7-day
   * weigh-in delta via `buildWeightRangeStats` (shared with the
   * Progress tab, `src/lib/nutrition/progressRangeStats.ts`) so the
   * modal's weight row is never fabricated: `weekDeltaKg` is `null`
   * whenever fewer than 2 weigh-ins fall in the trailing 7-day
   * window (no data, or a single weigh-in).
   */
  weightKgByDay: Record<string, number>;
  /** Raw `useState` dispatch for `profileTargets` — `handleWeeklyCheckinAccept`
   *  is the only mutation path for this hook (optimistic local target bump on
   *  accept); every other write to `profileTargets` stays in
   *  `loadProfileTargets` in TodayScreen. */
  setProfileTargets: Dispatch<SetStateAction<TrackerMacroTargets>>;
};

export type UseTodayWeeklyCheckinResult = {
  weeklyCheckinOpen: boolean;
  weeklyCheckinContent: WeeklyCheckinContent | null;
  /** ENG-805 (Redesign — Design Direction 2026): the check-in is NOT
   *  auto-opened as a cold-open blocking modal — the in-feed
   *  `WeeklyCheckinBanner` (→ /weekly-recap) is the non-blocking entry point.
   *  `redesign_winmoment` collapsed permanently-on (ENG-1651) — always `true`
   *  now; kept as an explicit field since TodayScreen still reads it. */
  checkinAsCard: boolean;
  handleWeeklyCheckinAccept: () => void;
  handleWeeklyCheckinDismiss: () => void;
  /** Exposed raw setter — `loadProfileTargets` (the single-round-trip
   *  profile loader that hydrates ~20 unrelated `profiles` fields in
   *  TodayScreen) hydrates `last_weekly_checkin_shown_at` through this
   *  directly. Pulling that loader apart is out of scope for this pass —
   *  every mutation *after* initial load goes through this hook. */
  setWeeklyCheckinShownAt: (iso: string | null) => void;
};

/**
 * ENG-1594 (Today extract, slice 1) — Weekly TDEE check-in ritual (PR
 * claude/weekly-checkin-ritual-v2, 2026-05-02 — rebuild of #26). The
 * MacroFactor-style modal that surfaces the adaptive-vs-formula TDEE delta
 * once a week. Gating + content build live in `src/lib/nutrition/weeklyCheckin.ts`;
 * this hook owns the screen-level state, the once-per-week eligibility gate,
 * and the accept/dismiss handlers. Modal NEVER blocks — every dismiss path
 * persists the decision and clears the open state.
 *
 * ## Why a hook
 *
 * The ritual is a fully self-contained concern: 3 pieces of state + 1 ref,
 * one gating effect, two handlers, consumed by exactly one render site
 * (`<WeeklyCheckinModal>` in TodayScreen). Extracting it removes ~160 lines
 * of gating logic from the Today parent without touching any of the ~15
 * external inputs it reads (all passed through as params, several kept as
 * the same object reference as the caller's `useMemo` output — see the
 * `weekData` / `resolvedMaintenance` note below).
 *
 * ## What stays in TodayScreen
 *
 * `loadProfileTargets` (the single-round-trip profile loader) still calls
 * `setWeeklyCheckinShownAt` directly via the exposed setter, matching the
 * `useTodayHydrationStimulants` precedent — pulling that loader apart is a
 * separate, larger effort. The `<WeeklyCheckinModal>` JSX itself also stays
 * in TodayScreen (this hook returns data + callbacks only, consistent with
 * every other extracted Today hook).
 *
 * ## Dependency-identity note
 *
 * `weekData` and `resolvedMaintenance` are accepted as the *same object
 * reference* TodayScreen's own `useMemo`s produce (typed here with a
 * narrower structural type, not reconstructed) and used as single deps in
 * the effect below — this preserves the exact original re-run cadence
 * (e.g. the effect re-runs whenever `resolvedMaintenance`'s identity
 * changes, not only when `.formulaKcal` changes). Do not replace either
 * with a narrower primitive without re-verifying the effect's fire timing.
 *
 * ## Failure modes
 *
 * - `userId` not yet resolved → the gate no-ops rather than firing against
 *   an unscoped profile row.
 * - Supabase persist of `last_weekly_checkin_shown_at` / the accept/dismiss
 *   decision fails → fire-and-forget (`void supabase...`), matching the
 *   pre-extraction behaviour exactly; the modal has already closed
 *   optimistically and the local `weeklyCheckinShownAt` stays advanced, so
 *   the ritual won't re-fire this session even if the write silently failed.
 */
export function useTodayWeeklyCheckin({
  userId,
  isToday,
  editingMeal,
  params,
  profileMaintenanceTdeeKcal,
  profileMaintenanceConfidence,
  weekData,
  targetCalories,
  resolvedMaintenance,
  profileSex,
  weightKgByDay,
  setProfileTargets,
}: UseTodayWeeklyCheckinParams): UseTodayWeeklyCheckinResult {
  const [weeklyCheckinShownAt, setWeeklyCheckinShownAt] = useState<string | null>(null);
  const [weeklyCheckinOpen, setWeeklyCheckinOpen] = useState(false);
  const [weeklyCheckinContent, setWeeklyCheckinContent] =
    useState<WeeklyCheckinContent | null>(null);
  const checkinAsCard = true;
  const weeklyCheckinHandledRef = useRef(false);

  // Weekly check-in ritual gate (PR claude/weekly-checkin-ritual-v2,
  // 2026-05-02 — rebuild of #26). Runs once per Today first-load —
  // `weeklyCheckinHandledRef` suppresses re-fires for the rest of the
  // session even if `weekData` recomputes. Honest weight delta
  // (ENG-1585): `weightDeltaKg` is the real trailing-7-day weigh-in
  // delta via `buildWeightRangeStats` (same helper the Progress tab
  // uses) — still `null`, not fabricated, when fewer than 2 weigh-ins
  // fall in that window; the modal suppresses the row in that case.
  useEffect(() => {
    if (!isToday) return;
    if (weeklyCheckinHandledRef.current) return;
    if (!userId) return;
    // build-45 bug fix (2026-05-08): when the user navigates to
    // /meal-nutrition then taps Edit, the host route returns with
    // `editMealId` and TodayEditMealModal opens. The weekly check-in
    // useEffect re-fires on the same focus event and opens its modal
    // ON TOP of the edit modal — both are presented at the same RN
    // Modal level and iOS blocks input on the back one → page freezes.
    //
    // build-47 follow-up (2026-05-08): the original guard returned
    // early WITHOUT setting `weeklyCheckinHandledRef.current = true`,
    // so the moment the edit modal closed the gate re-ran with the
    // guard cleared and the check-in popped immediately after every
    // edit ("This keeps popping up every time I edit an item"). Fix:
    // when we observe the edit flow, ALSO mark the check-in as
    // handled for the rest of this session. The check-in is once-per-
    // week server-side; deferring to the next app launch is fine.
    if (
      editingMeal != null ||
      (typeof params.editMealId === "string" && params.editMealId.length > 0)
    ) {
      weeklyCheckinHandledRef.current = true;
      return;
    }
    // Map adaptive confidence string into the gate's typed enum. Any
    // unrecognised value (legacy / null / future addition) routes to
    // null which the gate treats as "math hasn't resolved" → no fire.
    const conf: WeeklyCheckinConfidence | null =
      profileMaintenanceConfidence === "medium" || profileMaintenanceConfidence === "high"
        ? profileMaintenanceConfidence
        : profileMaintenanceConfidence === "low"
          ? "low"
          : null;
    const daysLoggedThisWeek = weekData.days.filter(
      (d) => d.totals.calories > 0,
    ).length;
    const eligible = shouldShowWeeklyCheckin({
      adaptiveTdeeConfidence: conf,
      adaptiveTdee: profileMaintenanceTdeeKcal,
      daysLoggedThisWeek,
      lastShownAt: weeklyCheckinShownAt,
    });
    if (!eligible) return;
    if (!Number.isFinite(targetCalories) || targetCalories <= 0) return;
    weeklyCheckinHandledRef.current = true;

    const content = buildWeeklyCheckinContent({
      adaptiveTdee: profileMaintenanceTdeeKcal as number,
      // Prefer the shared `formulaKcal` resolver output as the prior
      // baseline. When the user's profile is incomplete the resolver
      // returns null; the content builder honestly suppresses the
      // delta line.
      priorTdee: resolvedMaintenance?.formulaKcal ?? null,
      currentTargetKcal: targetCalories,
      avgCaloriesThisWeek: weekData.weekAvg.calories,
      // ENG-1585 — real trailing-7-day weigh-in delta (rounded to 0.1
      // kg by `buildWeightRangeStats`), null when < 2 weigh-ins fall
      // in that window. Never fabricated.
      weightDeltaKg: buildWeightRangeStats(weightKgByDay, "7d").weekDeltaKg,
      // ENG-1027 — sex-aware suggested-target floor (never suggest a man
      // below 1,500 / a woman below 1,200).
      sex: profileSex,
    });
    setWeeklyCheckinContent(content);
    // ENG-805 — never cold-open the blocking modal; the in-feed banner is
    // the only entry point (matches web).

    // Optimistically stamp the shown-at on the row so we don't re-fire
    // on a hot reload, even if the analytics emit fails. Server is
    // source of truth — refetch on next loadProfileTargets() will
    // overwrite with the canonical value.
    const nowIso = new Date().toISOString();
    setWeeklyCheckinShownAt(nowIso);
    void supabase
      .from("profiles")
      .update({ last_weekly_checkin_shown_at: nowIso } as never)
      .eq("id", userId);

    try {
      track(AnalyticsEvents.weekly_checkin_shown, {
        confidence: conf,
        tdeeDeltaKcal: content.tdeeDeltaKcal,
        daysLoggedThisWeek,
        platform: "ios",
      });
    } catch {
      /* noop */
    }
  }, [
    isToday,
    userId,
    profileMaintenanceTdeeKcal,
    profileMaintenanceConfidence,
    weekData,
    targetCalories,
    resolvedMaintenance,
    weeklyCheckinShownAt,
    editingMeal,
    params.editMealId,
    weightKgByDay,
  ]);

  const handleWeeklyCheckinAccept = useCallback(() => {
    if (!userId || !weeklyCheckinContent) {
      setWeeklyCheckinOpen(false);
      return;
    }
    const newTarget = weeklyCheckinContent.suggestedTargetKcal;
    const previous = targetCalories;
    setWeeklyCheckinOpen(false);
    try {
      track(AnalyticsEvents.weekly_checkin_accepted, {
        tdeeDeltaKcal: weeklyCheckinContent.tdeeDeltaKcal,
        previousTargetKcal: previous,
        suggestedTargetKcal: newTarget,
        platform: "ios",
      });
    } catch {
      /* noop */
    }
    // Optimistic local update so the rings reflect the new target
    // without waiting for the round-trip.
    setProfileTargets((prev) => ({ ...prev, calories: newTarget }));
    void supabase
      .from("profiles")
      .update({
        target_calories: newTarget,
        target_calories_set_at: new Date().toISOString(),
        // Same enum value the maintenance-recalibration suggestion
        // already uses, so the existing 21-day Rule 2 cooldown
        // works correctly.
        target_calories_source: "digest_recalibration",
        last_weekly_checkin_decision: "accepted",
      } as never)
      .eq("id", userId);
  }, [userId, weeklyCheckinContent, targetCalories, setProfileTargets]);

  const handleWeeklyCheckinDismiss = useCallback(() => {
    setWeeklyCheckinOpen(false);
    try {
      track(AnalyticsEvents.weekly_checkin_dismissed, {
        reason: "kept_current",
        platform: "ios",
      });
    } catch {
      /* noop */
    }
    if (!userId) return;
    void supabase
      .from("profiles")
      .update({ last_weekly_checkin_decision: "kept_current" } as never)
      .eq("id", userId);
  }, [userId]);

  return {
    weeklyCheckinOpen,
    weeklyCheckinContent,
    checkinAsCard,
    handleWeeklyCheckinAccept,
    handleWeeklyCheckinDismiss,
    setWeeklyCheckinShownAt,
  };
}
