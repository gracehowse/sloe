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
import { safetyFloorFor } from "../../../lib/onboarding/targets.ts";
import { mapPaceToPreset } from "../../../lib/onboarding/persist.ts";
import {
  dbGoalToSliderGoal,
  paceChanged,
  paceRangeForDbGoal,
  parseGoalEditorProfileRow,
  parseHeightInputToCm,
  parseWeightInputToKg,
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

  const [goal, setGoal] = React.useState<EditorDbGoal>("cut");
  const [pace, setPace] = React.useState(0);
  const [seatedPace, setSeatedPace] = React.useState(0);
  const [goalWeightInput, setGoalWeightInput] = React.useState("");
  const [weightInput, setWeightInput] = React.useState("");
  const [heightCmInput, setHeightCmInput] = React.useState("");
  const [heightFeetInput, setHeightFeetInput] = React.useState("");
  const [heightInchesInput, setHeightInchesInput] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
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
      const seat = seatPaceForEditor({
        goal: p.goal,
        paceKgPerWeek: p.paceKgPerWeek,
        planPace: p.planPace,
      });

      setLoaded(p);
      setGoal(p.goal);
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
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const measurementSystem = loaded?.measurementSystem ?? "metric";
  const weightUnit = measurementSystem === "imperial" ? "lb" : "kg";
  const sliderRange = React.useMemo(() => paceRangeForDbGoal(goal), [goal]);
  const sliderGoal = React.useMemo(() => dbGoalToSliderGoal(goal), [goal]);

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

  const goalChanged = loaded != null && goal !== loaded.goal;
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

  const dirty = recomputeChanged || goalWeightChanged;

  const preview = React.useMemo<RecomputedTargets | null>(() => {
    if (!loaded || !recomputeChanged) return null;
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
    });
  }, [loaded, goal, pace, effectiveWeightKg, effectiveHeightCm, recomputeChanged]);

  const belowSafetyFloor =
    preview != null &&
    goal === "cut" &&
    preview.target_calories < safetyFloorFor(loaded?.sex ?? null);

  const handleSave = React.useCallback(async () => {
    if (!dirty || saving || !loaded) return;
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

      const recomputed = recomputeChanged ? preview : null;
      const continuousPace =
        goal === "maintain" ? 0 : recomputeChanged ? pace : undefined;

      const result = await persistRecomputedTargets(supabase, uid, {
        profileUpdate,
        recomputed,
        source: "recompute",
        paceKgPerWeek: continuousPace,
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
          recomputed: recomputed != null,
          newTargetKcal: recomputed?.target_calories ?? null,
          belowSafetyFloor,
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
    belowSafetyFloor,
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
    preview,
    belowSafetyFloor,
    handleSave,
  };
}
