"use client";

/**
 * useGoalPaceEditorDialog — composition-root hook for the web
 * `GoalPaceEditorDialog`. Owns ALL load / derive / persist logic so the
 * dialog file stays a thin presentation shell (mirrors the mobile
 * `useGoalPaceEditor` hook — both call the same shared helpers in
 * `@/lib/nutrition/goalEditorPace` so web + mobile can't drift).
 *
 * Stage 2 of the target-recompute unification (2026-05-26): adaptive-
 * aware preview, continuous pace seated from `pace_kg_per_week` (else the
 * legacy `plan_pace` preset), editable weight/height, dirty-tracking
 * against the seated continuous pace.
 */

import * as React from "react";

import { supabase } from "../../../lib/supabase/browserClient.ts";
import { track } from "../../../lib/analytics/track.ts";
import { AnalyticsEvents } from "../../../lib/analytics/events.ts";
import {
  recomputeTargetsFromProfile,
  type RecomputedTargets,
} from "../../../lib/nutrition/recomputeTargetsForActivity.ts";
import { persistRecomputedTargets } from "../../../lib/nutrition/persistRecomputedTargets.ts";
import {
  DEFAULT_HIGH_DAYS,
  type DayTargetScheduleId,
} from "../../../lib/nutrition/dayTargetSchedule.ts";
import { safetyFloorFor } from "../../../lib/onboarding/targets.ts";
import { mapPaceToPreset } from "../../../lib/onboarding/persist.ts";
import {
  canSaveBelowFloor,
  dbGoalToSliderGoal,
  paceChanged,
  paceRangeForDbGoal,
  parseGoalEditorProfileRow,
  parseHeightInputToCm,
  parseWeightInputToKg,
  parseFiberInputToG,
  fiberGoalChanged,
  seatPaceForEditor,
  GOAL_EDITOR_PROFILE_COLUMNS,
  type EditorDbGoal,
  type LoadedGoalEditorProfile,
} from "../../../lib/nutrition/goalEditorPace.ts";
import {
  cmToFeetInches,
  feetInchesToCm,
  kgToLb,
  lbToKg,
} from "../../../lib/units/imperial.ts";

export interface UseGoalPaceEditorDialogArgs {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function useGoalPaceEditorDialog({
  open,
  onOpenChange,
  onSaved,
}: UseGoalPaceEditorDialogArgs) {
  const [loading, setLoading] = React.useState(true);
  const [loaded, setLoaded] = React.useState<LoadedGoalEditorProfile | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // ENG-1507 — `null` = unknown/unset goal on the profile row. The editor
  // seats NO selection and Save stays disabled until the user picks —
  // never the old silent 'cut' default that then wrote 'cut' back.
  const [goal, setGoal] = React.useState<EditorDbGoal | null>(null);
  const [pace, setPace] = React.useState(0);
  const [seatedPace, setSeatedPace] = React.useState(0);
  const [goalWeightInput, setGoalWeightInput] = React.useState("");
  const [weightInput, setWeightInput] = React.useState("");
  const [heightCmInput, setHeightCmInput] = React.useState("");
  const [heightFeetInput, setHeightFeetInput] = React.useState("");
  const [heightInchesInput, setHeightInchesInput] = React.useState("");
  const [fiberInput, setFiberInput] = React.useState("");
  // ENG-960 — opt-in day-target schedule. "same" = flat week (the default);
  // the two presets cycle the weekly calories weekly-neutrally.
  const [calorieSchedule, setCalorieSchedule] =
    React.useState<DayTargetScheduleId | "same">("same");
  // ENG-1027 — explicit below-floor acknowledgment (Cronometer pattern).
  const [acknowledged, setAcknowledged] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setAcknowledged(false);
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      if (!uid || cancelled) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select(GOAL_EDITOR_PROFILE_COLUMNS)
        .eq("id", uid)
        .maybeSingle();
      if (cancelled) return;
      const p = parseGoalEditorProfileRow(data as Record<string, unknown> | null);
      const ms = p.measurementSystem;
      // ENG-1507 — no goal on the row seats no selection (pace 0 until picked).
      const seat = p.goal
        ? seatPaceForEditor({
            goal: p.goal,
            paceKgPerWeek: p.paceKgPerWeek,
            planPace: p.planPace,
          })
        : 0;

      setLoaded(p);
      setGoal(p.goal);
      setCalorieSchedule(p.calorieSchedule ?? "same");
      setPace(seat);
      setSeatedPace(seat);
      setGoalWeightInput(
        p.goalWeightKg == null
          ? ""
          : ms === "imperial"
            ? String(Math.round(kgToLb(p.goalWeightKg) * 10) / 10)
            : String(Math.round(p.goalWeightKg * 10) / 10),
      );
      setWeightInput(
        p.weightKg == null
          ? ""
          : ms === "imperial"
            ? String(Math.round(kgToLb(p.weightKg) * 10) / 10)
            : String(Math.round(p.weightKg * 10) / 10),
      );
      if (p.heightCm == null) {
        setHeightCmInput("");
        setHeightFeetInput("");
        setHeightInchesInput("");
      } else if (ms === "imperial") {
        const { feet, inches } = cmToFeetInches(p.heightCm);
        setHeightFeetInput(String(feet));
        setHeightInchesInput(String(inches));
        setHeightCmInput("");
      } else {
        setHeightCmInput(String(Math.round(p.heightCm)));
        setHeightFeetInput("");
        setHeightInchesInput("");
      }
      setFiberInput(
        p.targetFiberG != null && p.targetFiberG > 0 ? String(p.targetFiberG) : "",
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const measurementSystem = loaded?.measurementSystem ?? "metric";
  const weightUnit = measurementSystem === "imperial" ? "lb" : "kg";
  // Render fallback while no goal is selected — Save is gated on a pick,
  // so the 'cut' range here can never be persisted un-chosen.
  const sliderRange = React.useMemo(() => paceRangeForDbGoal(goal ?? "cut"), [goal]);
  const sliderGoal = React.useMemo(() => dbGoalToSliderGoal(goal ?? "cut"), [goal]);

  const onChangeGoal = React.useCallback(
    (next: EditorDbGoal) => {
      setGoal(next);
      if (next === "maintain") {
        setPace(0);
      } else if (loaded) {
        setPace(
          seatPaceForEditor({
            goal: next,
            paceKgPerWeek: loaded.paceKgPerWeek,
            planPace: loaded.planPace,
          }),
        );
      }
    },
    [loaded],
  );

  const editedWeightKg = React.useMemo(
    () => parseWeightInputToKg(weightInput, measurementSystem, lbToKg),
    [weightInput, measurementSystem],
  );
  const editedHeightCm = React.useMemo(
    () =>
      parseHeightInputToCm(
        measurementSystem === "imperial"
          ? {
              measurementSystem: "imperial",
              feet: heightFeetInput,
              inches: heightInchesInput,
            }
          : { measurementSystem: "metric", cm: heightCmInput },
        feetInchesToCm,
      ),
    [measurementSystem, heightCmInput, heightFeetInput, heightInchesInput],
  );
  const effectiveWeightKg = editedWeightKg ?? loaded?.weightKg ?? null;
  const effectiveHeightCm = editedHeightCm ?? loaded?.heightCm ?? null;

  const goalWeightKg = React.useMemo<number | null>(
    () => parseWeightInputToKg(goalWeightInput, measurementSystem, lbToKg),
    [goalWeightInput, measurementSystem],
  );

  const goalChanged = loaded != null && goal != null && goal !== loaded.goal;
  const paceMoved =
    loaded != null && goal !== "maintain" && paceChanged(pace, seatedPace);
  const weightChanged =
    loaded != null &&
    editedWeightKg != null &&
    (loaded.weightKg == null || Math.abs(editedWeightKg - loaded.weightKg) > 0.05);
  const heightChanged =
    loaded != null &&
    editedHeightCm != null &&
    (loaded.heightCm == null || Math.abs(editedHeightCm - loaded.heightCm) >= 1);
  const recomputeChanged = goalChanged || paceMoved || weightChanged || heightChanged;

  const goalWeightChanged = React.useMemo(() => {
    if (!loaded) return false;
    const a = loaded.goalWeightKg;
    if (a == null && goalWeightKg == null) return false;
    if (a == null || goalWeightKg == null) return true;
    return Math.abs(a - goalWeightKg) > 0.05;
  }, [loaded, goalWeightKg]);

  const editedFiberG = React.useMemo(
    () => parseFiberInputToG(fiberInput),
    [fiberInput],
  );
  const fiberChanged = React.useMemo(
    () => loaded != null && fiberGoalChanged(loaded.targetFiberG, editedFiberG),
    [loaded, editedFiberG],
  );

  // ENG-960 — a schedule-only edit is savable on its own (no target recompute).
  const scheduleChanged =
    loaded != null && (loaded.calorieSchedule ?? "same") !== calorieSchedule;

  const dirty = recomputeChanged || goalWeightChanged || fiberChanged || scheduleChanged;

  const preview = React.useMemo<RecomputedTargets | null>(() => {
    if (!loaded || !recomputeChanged || goal == null) return null;
    if (effectiveWeightKg == null || effectiveHeightCm == null || loaded.age == null) {
      return null;
    }
    return recomputeTargetsFromProfile({
      sex: loaded.sex,
      weightKg: effectiveWeightKg,
      heightCm: effectiveHeightCm,
      age: loaded.age,
      activityLevel: loaded.activityLevel,
      goal,
      planPace: goal === "maintain" ? null : mapPaceToPreset(pace),
      nutritionStrategy: loaded.nutritionStrategy,
      adaptiveTdee: loaded.adaptiveTdee,
      adaptiveTdeeConfidence: loaded.adaptiveTdeeConfidence,
      adaptiveTdeeUpdatedAt: loaded.adaptiveTdeeUpdatedAt,
      // ENG-1506 — canonical latest-weigh-in maintenance baseline, but ONLY
      // when the user hasn't explicitly edited weight (an explicit edit wins).
      weightKgByDay: editedWeightKg != null ? null : loaded.weightKgByDay,
    });
  }, [loaded, goal, pace, effectiveWeightKg, effectiveHeightCm, recomputeChanged, editedWeightKg]);

  const previewFiberG = React.useMemo(() => {
    if (editedFiberG != null) return editedFiberG;
    if (preview) return preview.target_fiber_g;
    return loaded?.targetFiberG ?? null;
  }, [editedFiberG, preview, loaded?.targetFiberG]);

  const belowSafetyFloor =
    preview != null &&
    goal === "cut" &&
    preview.target_calories < safetyFloorFor(loaded?.sex ?? null);

  // ENG-1027 — drop a stale acknowledgment the moment the target climbs
  // back above the floor, so a user can't acknowledge once and then keep
  // ratcheting the pace down under cover of an old confirmation.
  React.useEffect(() => {
    if (!belowSafetyFloor && acknowledged) setAcknowledged(false);
  }, [belowSafetyFloor, acknowledged]);

  // The sex floor for the live target — surfaced so the dialog can name
  // the exact number in the acknowledge copy (1,500 male / 1,200 female).
  const safetyFloorKcal = safetyFloorFor(loaded?.sex ?? null);

  // Gate: when below the floor, Save is disabled until the user ticks the
  // acknowledgment. Above the floor this is always true.
  const canSave =
    goal != null &&
    canSaveBelowFloor({ belowSafetyFloor, acknowledged }) &&
    (!fiberChanged || editedFiberG != null);

  const handleSave = React.useCallback(async () => {
    // ENG-1507 — no goal picked = nothing to save; never fall back to 'cut'.
    if (!dirty || saving || !loaded || goal == null) return;
    // ENG-1027 — never persist a below-floor target without the explicit
    // acknowledgment. The button is disabled in this state, but guard the
    // commit path too so a programmatic call can't bypass it.
    if (!canSaveBelowFloor({ belowSafetyFloor, acknowledged })) return;
    setSaving(true);
    setError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      if (!uid) {
        setError("Sign in to change your goal.");
        setSaving(false);
        return;
      }

      const profileUpdate: Record<string, unknown> = {};
      if (goalChanged) profileUpdate.goal = goal;
      if (goal === "maintain") {
        if (loaded.goal !== "maintain") profileUpdate.plan_pace = null;
      } else if (recomputeChanged) {
        profileUpdate.plan_pace = mapPaceToPreset(pace);
      }
      if (weightChanged && editedWeightKg != null) profileUpdate.weight_kg = editedWeightKg;
      if (heightChanged && editedHeightCm != null) profileUpdate.height_cm = editedHeightCm;
      if (goalWeightChanged) profileUpdate.goal_weight_kg = goalWeightKg;
      if (scheduleChanged) {
        // ENG-960 — the opt-in day-target schedule. "same" clears it back to the
        // flat week (null); a preset writes its id + the weekend high-day set.
        profileUpdate.calorie_schedule = calorieSchedule === "same" ? null : calorieSchedule;
        profileUpdate.high_days = calorieSchedule === "same" ? null : DEFAULT_HIGH_DAYS;
      }

      const recomputed = recomputeChanged ? preview : null;
      const continuousPace =
        goal === "maintain" ? 0 : recomputeChanged ? pace : undefined;

      const result = await persistRecomputedTargets(supabase, uid, {
        profileUpdate,
        recomputed,
        source: "recompute",
        paceKgPerWeek: continuousPace,
        fiberOverrideG: fiberChanged ? editedFiberG : undefined,
      });

      if (!result.ok) {
        setError("Couldn't save your goal. Please try again.");
        setSaving(false);
        return;
      }

      try {
        track(AnalyticsEvents.goal_pace_adjusted, {
          previousGoal: loaded.goal,
          newGoal: goal,
          previousPlanPace: loaded.planPace,
          newPlanPace: goal === "maintain" ? null : mapPaceToPreset(pace),
          paceKgPerWeek: goal === "maintain" ? 0 : pace,
          weightChanged,
          heightChanged,
          goalWeightChanged,
          fiberChanged,
          recomputed: recomputed != null,
          newTargetKcal: recomputed?.target_calories ?? null,
          belowSafetyFloor,
          // ENG-1027 — record explicit below-floor acknowledgment.
          belowFloorAcknowledged: belowSafetyFloor ? acknowledged : false,
          surface: "settings_targets",
        });
      } catch {
        /* fire-and-forget */
      }

      setSaving(false);
      onSaved?.();
      onOpenChange(false);
    } catch {
      setError("Couldn't save your goal. Please try again.");
      setSaving(false);
    }
  }, [
    dirty,
    saving,
    loaded,
    goal,
    goalChanged,
    pace,
    recomputeChanged,
    weightChanged,
    heightChanged,
    editedWeightKg,
    editedHeightCm,
    goalWeightChanged,
    goalWeightKg,
    preview,
    fiberChanged,
    editedFiberG,
    belowSafetyFloor,
    acknowledged,
    onSaved,
    onOpenChange,
  ]);

  return {
    loading,
    saving,
    error,
    dirty,
    goal,
    onChangeGoal,
    calorieSchedule,
    setCalorieSchedule,
    pace,
    setPace,
    sliderRange,
    sliderGoal,
    measurementSystem,
    weightUnit,
    weightInput,
    setWeightInput,
    heightCmInput,
    setHeightCmInput,
    heightFeetInput,
    setHeightFeetInput,
    heightInchesInput,
    setHeightInchesInput,
    goalWeightInput,
    setGoalWeightInput,
    fiberInput,
    setFiberInput,
    previewFiberG,
    preview,
    belowSafetyFloor,
    safetyFloorKcal,
    // ENG-1027 — acknowledge-to-proceed gate
    acknowledged,
    setAcknowledged,
    canSave,
    handleSave,
  };
}
