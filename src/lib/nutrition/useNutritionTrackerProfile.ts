"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabase/browserClient.ts";
import { DEFAULT_STEPS_GOAL } from "../../types/profile.ts";
import { resolveMaintenance } from "./resolveMaintenance.ts";
import {
  ENERGY_NUMBERS_V1_FLAG,
  selectMaintenance,
  type EnergyProfileRow,
} from "./energyNumbers.ts";
import { MEASURED_TDEE_CHECK_IN_FLAG } from "./measuredTdee.ts";
import { isFeatureEnabled } from "../analytics/track.ts";
import { readFreezeLedger, type FreezeLedger } from "./streakFreeze.ts";
import { normalizeTrackedDashboardMacros, parseStepsDayMap } from "./trackerLocalState.ts";
import { parseUserMealSlotConfig, type UserMealSlotConfig } from "./userMealSlotConfig";

export type FastingSessionRow = { start: string; end: string | null };

/**
 * ENG-1360 (first extraction pass) — pure data hook for the one big
 * `profiles` row fetch NutritionTracker ran on mount/`authedUserId` change.
 * This is a byte-for-byte lift of the original `useEffect`: same query,
 * same column list, same per-field parsing/validation, same setters — just
 * relocated so the host component's state list shrinks. No behavior change.
 *
 * Two fields (`trackedDashboardMacros`, `weeklyCheckinShownAt`) are also
 * written to from OUTSIDE this fetch (a visibility-refresh refetch and the
 * weekly check-in ritual, respectively) — their setters are returned
 * alongside the values so those call sites keep working unmodified.
 */
export function useNutritionTrackerProfile(authedUserId: string | null | undefined) {
  const [weekStartDay, setWeekStartDay] = useState<"monday" | "sunday">("monday");
  const [freezeLedger, setFreezeLedger] = useState<FreezeLedger>({
    earnedAt: [],
    usedHistory: [],
  });
  const [freezeBudgetMax, setFreezeBudgetMax] = useState<number>(3);
  const [trackedDashboardMacros, setTrackedDashboardMacros] = useState<string[]>([
    "protein",
    "carbs",
    "fat",
  ]);
  const [userMealSlotConfig, setUserMealSlotConfig] = useState<UserMealSlotConfig | null>(
    null,
  );
  const [stepsByDay, setStepsByDay] = useState<Record<string, number>>({});
  const [dailyStepsGoal, setDailyStepsGoal] = useState(DEFAULT_STEPS_GOAL);
  const [fastingSessions, setFastingSessions] = useState<FastingSessionRow[]>([]);
  const [fastingOptedIn, setFastingOptedIn] = useState<boolean>(false);
  const [profileWeightKg, setProfileWeightKg] = useState<number | null>(null);
  const [profileGoal, setProfileGoal] = useState<string | null>(null);
  const [profilePlanPace, setProfilePlanPace] = useState<string | null>(null);
  const [profileMaintenanceTdee, setProfileMaintenanceTdee] = useState<number | null>(null);
  const [profileWeightKgByDay, setProfileWeightKgByDay] = useState<Record<string, number>>({});
  const [weeklyCheckinShownAt, setWeeklyCheckinShownAt] = useState<string | null>(null);
  const [profileFormulaTdee, setProfileFormulaTdee] = useState<number | null>(null);
  // Raw adaptive TDEE + confidence, distinct from `profileMaintenanceTdee`
  // (the resolver-collapsed value). The weekly check-in gate wants the
  // adaptive value specifically.
  const [profileAdaptiveTdeeRaw, setProfileAdaptiveTdeeRaw] = useState<number | null>(null);
  const [profileAdaptiveTdeeConfidenceRaw, setProfileAdaptiveTdeeConfidenceRaw] = useState<
    "low" | "medium" | "high" | null
  >(null);
  const [profileMaintenanceSource, setProfileMaintenanceSource] = useState<
    "measured" | "adaptive" | "formula" | null
  >(null);
  const [profileMaintenanceConfidence, setProfileMaintenanceConfidence] = useState<
    "low" | "medium" | "high" | null
  >(null);
  const [profileSex, setProfileSex] = useState<"male" | "female" | "unspecified" | null>(null);
  const [profileHeightCm, setProfileHeightCm] = useState<number | null>(null);
  const [profileAge, setProfileAge] = useState<number | null>(null);
  const [profileActivityLevel, setProfileActivityLevel] = useState<
    "sedentary" | "light" | "moderate" | "active" | "very_active" | null
  >(null);

  useEffect(() => {
    if (!authedUserId) return;
    supabase
      .from("profiles")
      .select(
        "weight_kg, weight_kg_by_day, goal, plan_pace, sex, age, height_cm, activity_level, adaptive_tdee, adaptive_tdee_confidence, adaptive_tdee_updated_at, measured_tdee, measured_tdee_confidence, measured_tdee_updated_at, meal_slot_config, week_start_day, steps_by_day, daily_steps_goal, fasting_sessions, fasting_window, tracked_macros, streak_freeze_budget_max, streak_freezes_earned_at, streak_freezes_used_history, last_weekly_checkin_shown_at",
      )
      .eq("id", authedUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const wsd = (data as { week_start_day?: string }).week_start_day;
        if (wsd === "sunday" || wsd === "monday") setWeekStartDay(wsd);

        // Batch 4.11 — freeze ledger loads alongside other profile bits.
        const rawEarned = (data as { streak_freezes_earned_at?: unknown })
          .streak_freezes_earned_at;
        const rawUsed = (data as { streak_freezes_used_history?: unknown })
          .streak_freezes_used_history;
        setFreezeLedger(
          readFreezeLedger({ earnedAt: rawEarned, usedHistory: rawUsed }),
        );
        const rawBudget = Number(
          (data as { streak_freeze_budget_max?: number }).streak_freeze_budget_max,
        );
        setFreezeBudgetMax(
          Number.isFinite(rawBudget) ? Math.max(0, Math.min(10, rawBudget)) : 3,
        );
        setTrackedDashboardMacros(
          normalizeTrackedDashboardMacros((data as { tracked_macros?: unknown }).tracked_macros),
        );
        setUserMealSlotConfig(
          parseUserMealSlotConfig((data as { meal_slot_config?: unknown }).meal_slot_config),
        );
        setStepsByDay(parseStepsDayMap((data as { steps_by_day?: unknown }).steps_by_day));
        const sg = (data as { daily_steps_goal?: number }).daily_steps_goal;
        const sgN = sg != null ? Number(sg) : DEFAULT_STEPS_GOAL;
        setDailyStepsGoal(Number.isFinite(sgN) && sgN > 0 ? Math.round(sgN) : DEFAULT_STEPS_GOAL);
        const fs = (data as { fasting_sessions?: unknown }).fasting_sessions;
        if (Array.isArray(fs)) {
          setFastingSessions(fs as FastingSessionRow[]);
        }
        // F-109: hydrate the IF opt-in flag from `profiles.fasting_window`.
        // Non-null = user picked a window (onboarding or /fasting preset
        // chip) → idle "Start fast" pill renders on Today.
        const fwRaw = (data as { fasting_window?: unknown }).fasting_window;
        setFastingOptedIn(typeof fwRaw === "string" && fwRaw.length > 0);
        const w = data.weight_kg != null ? Number(data.weight_kg) : null;
        setProfileWeightKg(Number.isFinite(w) ? w : null);
        setProfileGoal((data as any).goal ?? null);
        setProfilePlanPace(
          typeof (data as any).plan_pace === "string" ? (data as any).plan_pace : null,
        );
        // Cache basics for the activity-bonus info popover (TestFlight
        // `AAtW7dYcCBPyBdsMU6UqiQQ`, 2026-04-18).
        const sexRaw = (data.sex ?? null) as string | null;
        setProfileSex(
          sexRaw === "male" || sexRaw === "female" || sexRaw === "unspecified" ? sexRaw : null,
        );
        const hCmRaw = data.height_cm != null ? Number(data.height_cm) : null;
        setProfileHeightCm(Number.isFinite(hCmRaw) && hCmRaw && hCmRaw > 0 ? hCmRaw : null);
        const ageRaw = data.age != null ? Number(data.age) : null;
        setProfileAge(Number.isFinite(ageRaw) && ageRaw && ageRaw > 0 ? ageRaw : null);
        const actRaw = (data.activity_level ?? null) as string | null;
        if (
          actRaw === "sedentary" ||
          actRaw === "light" ||
          actRaw === "moderate" ||
          actRaw === "active" ||
          actRaw === "very_active"
        ) {
          setProfileActivityLevel(actRaw);
        } else {
          setProfileActivityLevel(null);
        }
        // F-3 (2026-04-19, TestFlight `ADFYpDgEEb0QH-j3BXshPTo`):
        // single source of truth for the Activity Bonus Maintenance
        // tile + the Progress "Maintenance" card. Previously Today
        // used raw adaptive with no confidence gate while Progress
        // used `getEffectiveTDEE`'s gate — two surfaces, two numbers.
        // `resolveMaintenance` is the shared gate: adaptive wins at
        // medium/high confidence AND not stale, else formula.
        // ENG-1506 — behind `energy_numbers_v1`, inputs come from the
        // canonical `buildMaintenanceInputs` policy (latest weigh-in beats
        // the lagging profile snapshot; strict-null basics) so web Today
        // prints the SAME maintenance as every other surface. The legacy
        // input assembly stays alive in the else (kill switch).
        const resolved = isFeatureEnabled(ENERGY_NUMBERS_V1_FLAG)
          ? selectMaintenance(data as EnergyProfileRow, {
              enableMeasured: isFeatureEnabled(MEASURED_TDEE_CHECK_IN_FLAG),
            })
          : resolveMaintenance(
              {
                adaptive_tdee: (data as any).adaptive_tdee,
                adaptive_tdee_confidence: (data as any).adaptive_tdee_confidence,
                adaptive_tdee_updated_at: (data as any).adaptive_tdee_updated_at,
                measured_tdee: (data as any).measured_tdee,
                measured_tdee_confidence: (data as any).measured_tdee_confidence,
                measured_tdee_updated_at: (data as any).measured_tdee_updated_at,
                sex: (data.sex ?? "unspecified") as any,
                weight_kg: Number(data.weight_kg),
                height_cm: Number(data.height_cm),
                age: Number(data.age),
                activity_level: (data.activity_level ?? "sedentary") as any,
              },
              { enableMeasured: isFeatureEnabled(MEASURED_TDEE_CHECK_IN_FLAG) },
            );
        if (resolved) {
          setProfileMaintenanceTdee(resolved.kcal);
          setProfileMaintenanceSource(resolved.source);
          setProfileMaintenanceConfidence(resolved.confidence);
          // Capture the Mifflin formula baseline so the weekly check-in
          // ritual can compute the adaptive-vs-formula delta even when
          // the resolver landed on adaptive (in which case
          // `resolved.kcal` is the adaptive value and `formulaKcal` is
          // the prior baseline).
          setProfileFormulaTdee(resolved.formulaKcal ?? null);
        }
        // Raw adaptive TDEE + confidence — the weekly check-in gate
        // wants these specifically (resolver-collapsed maintenance
        // doesn't tell us whether adaptive_tdee itself is medium/high).
        const aTdeeRaw = (data as { adaptive_tdee?: unknown }).adaptive_tdee;
        const aTdeeNum =
          typeof aTdeeRaw === "number"
            ? aTdeeRaw
            : aTdeeRaw == null
              ? null
              : Number(aTdeeRaw);
        setProfileAdaptiveTdeeRaw(
          aTdeeNum != null && Number.isFinite(aTdeeNum) ? aTdeeNum : null,
        );
        const aConfRaw = (data as { adaptive_tdee_confidence?: unknown })
          .adaptive_tdee_confidence;
        setProfileAdaptiveTdeeConfidenceRaw(
          aConfRaw === "low" || aConfRaw === "medium" || aConfRaw === "high"
            ? aConfRaw
            : null,
        );
        // Weekly check-in shown-at hydration. Drives the 6-day cooldown.
        const lastCheckin = (data as { last_weekly_checkin_shown_at?: unknown })
          .last_weekly_checkin_shown_at;
        setWeeklyCheckinShownAt(typeof lastCheckin === "string" ? lastCheckin : null);
        const wkbdRaw = (data as { weight_kg_by_day?: unknown }).weight_kg_by_day;
        if (wkbdRaw && typeof wkbdRaw === "object" && !Array.isArray(wkbdRaw)) {
          const out: Record<string, number> = {};
          for (const [k, v] of Object.entries(wkbdRaw as Record<string, unknown>)) {
            const n = typeof v === "number" ? v : Number(v);
            if (Number.isFinite(n) && n > 0) out[k] = n;
          }
          setProfileWeightKgByDay(out);
        }
      });
  }, [authedUserId]);

  const refreshTrackedDashboardMacros = useCallback(async () => {
    if (!authedUserId) return;
    const { data } = await supabase
      .from("profiles")
      .select("tracked_macros")
      .eq("id", authedUserId)
      .maybeSingle();
    if (data) {
      setTrackedDashboardMacros(
        normalizeTrackedDashboardMacros((data as { tracked_macros?: unknown }).tracked_macros),
      );
    }
  }, [authedUserId]);

  useEffect(() => {
    const onVis = () => {
      if (typeof document === "undefined" || document.visibilityState !== "visible") return;
      void refreshTrackedDashboardMacros();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refreshTrackedDashboardMacros]);

  return {
    weekStartDay,
    freezeLedger,
    freezeBudgetMax,
    trackedDashboardMacros,
    userMealSlotConfig,
    stepsByDay,
    dailyStepsGoal,
    fastingSessions,
    fastingOptedIn,
    profileWeightKg,
    profileGoal,
    profilePlanPace,
    profileMaintenanceTdee,
    profileWeightKgByDay,
    weeklyCheckinShownAt,
    setWeeklyCheckinShownAt,
    profileFormulaTdee,
    profileAdaptiveTdeeRaw,
    profileAdaptiveTdeeConfidenceRaw,
    profileMaintenanceSource,
    profileMaintenanceConfidence,
    profileSex,
    profileHeightCm,
    profileAge,
    profileActivityLevel,
  };
}
