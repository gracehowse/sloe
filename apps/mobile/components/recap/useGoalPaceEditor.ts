/**
 * useGoalPaceEditor — composition-root hook for the mobile
 * `GoalPaceEditorSheet`. Owns ALL load / derive / persist logic so the
 * sheet file stays a thin presentation shell under the 400-line limit
 * (ENG-621). The web twin (`goal-pace-editor-dialog.tsx`) inlines the
 * same logic; both call the same shared helpers so they can't drift.
 *
 * Stage 2 of the target-recompute unification (2026-05-26):
 *   - loads the profile's adaptive-maintenance columns (adaptive_tdee,
 *     adaptive_tdee_confidence, adaptive_tdee_updated_at) + weight/height
 *     and feeds them into `recomputeTargetsFromProfile`, so the live
 *     preview is computed off adaptive maintenance when it's confident +
 *     fresh, exactly like the rest of the app;
 *   - seats a continuous kg/week pace slider from the stored
 *     `pace_kg_per_week` (else inferred from the `plan_pace` preset) and
 *     persists the continuous value (persist snaps `plan_pace`);
 *   - adds editable current-weight + height that feed the recompute;
 *   - tracks "dirty" against the SEATED continuous pace, so opening +
 *     saving unchanged never moves the target.
 *
 * Posture (unchanged from Stage 1): goal/pace/weight/height change →
 * recompute + provenance "recompute"; goal-weight-only → column write;
 * goal → maintain clears pace; safety floor is soft-warn-not-block.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";
import { isFeatureEnabled, track } from "@/lib/analytics";
import { ENERGY_NUMBERS_V1_FLAG } from "@suppr/nutrition-core/energyNumbers";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import {
  recomputeTargetsFromProfile,
  type RecomputedTargets,
} from "@suppr/nutrition-core/recomputeTargetsForActivity";
import { persistRecomputedTargets } from "@suppr/nutrition-core/persistRecomputedTargets";
import { safetyFloorFor } from "@suppr/shared/onboarding/targets";
import { mapPaceToPreset } from "@suppr/shared/onboarding/persist";
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
} from "@suppr/nutrition-core/goalEditorPace";
import {
  DEFAULT_HIGH_DAYS,
  type DayTargetScheduleId,
} from "@suppr/nutrition-core/dayTargetSchedule";
import {
  cmToFeetInches,
  feetInchesToCm,
  kgToLb,
  lbToKg,
} from "@suppr/shared/units/imperial";

type LoadedProfile = LoadedGoalEditorProfile;

export interface UseGoalPaceEditorArgs {
  visible: boolean;
  userId: string;
  onClose: () => void;
  onSaved?: () => void;
}

export function useGoalPaceEditor({
  visible,
  userId,
  onClose,
  onSaved,
}: UseGoalPaceEditorArgs) {
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState<LoadedProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Working state.
  // ENG-1507 — `null` = unknown/unset goal on the profile row. The editor
  // seats NO selection and Save stays disabled until the user picks —
  // never the old silent 'cut' default that then wrote 'cut' back.
  const [goal, setGoal] = useState<EditorDbGoal | null>(null);
  const [pace, setPace] = useState(0); // continuous kg/week
  const [seatedPace, setSeatedPace] = useState(0);
  const [goalWeightInput, setGoalWeightInput] = useState("");
  const [weightInput, setWeightInput] = useState("");
  const [heightCmInput, setHeightCmInput] = useState("");
  const [heightFeetInput, setHeightFeetInput] = useState("");
  const [heightInchesInput, setHeightInchesInput] = useState("");
  const [fiberInput, setFiberInput] = useState("");
  // ENG-960 — opt-in day-target schedule. "same" = flat week (default).
  const [calorieSchedule, setCalorieSchedule] =
    useState<DayTargetScheduleId | "same">("same");
  // ENG-1027 — explicit below-floor acknowledgment (Cronometer pattern).
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (!visible || !userId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSaving(false);
    setAcknowledged(false);
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select(GOAL_EDITOR_PROFILE_COLUMNS)
        .eq("id", userId)
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
  }, [visible, userId]);

  const measurementSystem = loaded?.measurementSystem ?? "metric";
  const weightUnit = measurementSystem === "imperial" ? "lb" : "kg";

  // When the goal flips to maintain, force pace to 0; when it flips back
  // to a directional goal, re-seat from the stored value (so the user
  // doesn't lose their place by toggling maintain on/off).
  const onChangeGoal = useCallback(
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

  // Render fallback while no goal is selected — Save is gated on a pick,
  // so the 'cut' range here can never be persisted un-chosen.
  const sliderRange = useMemo(() => paceRangeForDbGoal(goal ?? "cut"), [goal]);
  const sliderGoal = useMemo(() => dbGoalToSliderGoal(goal ?? "cut"), [goal]);

  // Editable weight / height parsed back to storage units (null when
  // blank/invalid — we never recompute off a garbage value).
  const editedWeightKg = useMemo(
    () => parseWeightInputToKg(weightInput, measurementSystem, lbToKg),
    [weightInput, measurementSystem],
  );
  const editedHeightCm = useMemo(
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

  // The weight / height actually used for the recompute: the edited value
  // when valid, else the loaded value.
  const effectiveWeightKg = editedWeightKg ?? loaded?.weightKg ?? null;
  const effectiveHeightCm = editedHeightCm ?? loaded?.heightCm ?? null;

  const goalWeightKg = useMemo<number | null>(
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

  // Anything that moves the calorie/macro target.
  const recomputeChanged =
    goalChanged || paceMoved || weightChanged || heightChanged;

  const goalWeightChanged = useMemo(() => {
    if (!loaded) return false;
    const a = loaded.goalWeightKg;
    if (a == null && goalWeightKg == null) return false;
    if (a == null || goalWeightKg == null) return true;
    return Math.abs(a - goalWeightKg) > 0.05;
  }, [loaded, goalWeightKg]);

  const editedFiberG = useMemo(
    () => parseFiberInputToG(fiberInput),
    [fiberInput],
  );
  const fiberChanged = useMemo(
    () => loaded != null && fiberGoalChanged(loaded.targetFiberG, editedFiberG),
    [loaded, editedFiberG],
  );

  // ENG-960 — a schedule-only edit is savable on its own.
  const scheduleChanged =
    loaded != null && (loaded.calorieSchedule ?? "same") !== calorieSchedule;

  const dirty = recomputeChanged || goalWeightChanged || fiberChanged || scheduleChanged;

  // Live preview — adaptive-aware. Only when a recompute input moved AND
  // we have the body basics.
  const preview = useMemo<RecomputedTargets | null>(() => {
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
      // ENG-1506 — canonical latest-weigh-in maintenance baseline, ONLY
      // behind `energy_numbers_v1` (flag OFF must preview AND persist the
      // exact pre-ENG-1506 recompute — review round 2026-07-11) and only
      // when the user hasn't explicitly edited weight (an explicit edit
      // wins).
      weightKgByDay:
        isFeatureEnabled(ENERGY_NUMBERS_V1_FLAG) && editedWeightKg == null
          ? loaded.weightKgByDay
          : null,
    });
  }, [loaded, goal, pace, effectiveWeightKg, effectiveHeightCm, recomputeChanged, editedWeightKg]);

  const previewFiberG = useMemo(() => {
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
  // ratcheting the pace down under the cover of an old confirmation.
  useEffect(() => {
    if (!belowSafetyFloor && acknowledged) setAcknowledged(false);
  }, [belowSafetyFloor, acknowledged]);

  // The sex floor for the live target — surfaced so the sheet can name
  // the exact number in the acknowledge copy (1,500 male / 1,200 female).
  const safetyFloorKcal = safetyFloorFor(loaded?.sex ?? null);

  // Gate: when below the floor the Save button is disabled until the user
  // ticks the acknowledgment. Above the floor this is always true.
  const canSave =
    goal != null &&
    canSaveBelowFloor({ belowSafetyFloor, acknowledged }) &&
    (!fiberChanged || editedFiberG != null);

  const handleConfirm = useCallback(async () => {
    // ENG-1507 — no goal picked = nothing to save; never fall back to 'cut'.
    if (!dirty || saving || !loaded || !userId || goal == null) {
      onClose();
      return;
    }
    // ENG-1027 — never persist a below-floor target without the explicit
    // acknowledgment. The button is disabled in this state, but guard the
    // commit path too so a programmatic call can't bypass it.
    if (!canSaveBelowFloor({ belowSafetyFloor, acknowledged })) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const profileUpdate: Record<string, unknown> = {};
      if (goalChanged) profileUpdate.goal = goal;
      if (goal === "maintain") {
        if (loaded.goal !== "maintain") profileUpdate.plan_pace = null;
      } else if (recomputeChanged) {
        // Snap the continuous pace to the legacy preset mirror.
        profileUpdate.plan_pace = mapPaceToPreset(pace);
      }
      if (weightChanged && editedWeightKg != null) {
        profileUpdate.weight_kg = editedWeightKg;
      }
      if (heightChanged && editedHeightCm != null) {
        profileUpdate.height_cm = editedHeightCm;
      }
      if (goalWeightChanged) profileUpdate.goal_weight_kg = goalWeightKg;
      if (scheduleChanged) {
        // ENG-960 — the opt-in day-target schedule. "same" clears it (null); a
        // preset writes its id + the weekend high-day set.
        profileUpdate.calorie_schedule = calorieSchedule === "same" ? null : calorieSchedule;
        profileUpdate.high_days = calorieSchedule === "same" ? null : DEFAULT_HIGH_DAYS;
      }

      const recomputed = recomputeChanged ? preview : null;
      // Lossless continuous pace persisted alongside the snapped preset.
      const continuousPace =
        goal === "maintain" ? 0 : recomputeChanged ? pace : undefined;

      const result = await persistRecomputedTargets(supabase, userId, {
        profileUpdate,
        recomputed,
        source: "recompute",
        paceKgPerWeek: continuousPace,
        fiberOverrideG: fiberChanged ? editedFiberG : undefined,
        // ENG-1506 — host-read flag for the past-day backfill's input policy.
        canonicalEnergyInputs: isFeatureEnabled(ENERGY_NUMBERS_V1_FLAG),
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
          // ENG-1027 — record that the user explicitly acknowledged the
          // below-floor target (only meaningful when belowSafetyFloor).
          belowFloorAcknowledged: belowSafetyFloor ? acknowledged : false,
          surface: "settings_targets",
        });
      } catch {
        /* fire-and-forget */
      }

      setSaving(false);
      onSaved?.();
      onClose();
    } catch {
      setError("Couldn't save your goal. Please try again.");
      setSaving(false);
    }
  }, [
    dirty,
    saving,
    loaded,
    userId,
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
    onClose,
  ]);

  return {
    // load state
    loading,
    saving,
    error,
    dirty,
    // goal + pace
    goal,
    onChangeGoal,
    calorieSchedule,
    setCalorieSchedule,
    pace,
    setPace,
    sliderRange,
    sliderGoal,
    // body fields
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
    // preview + safety
    preview,
    belowSafetyFloor,
    safetyFloorKcal,
    // ENG-1027 — acknowledge-to-proceed gate
    acknowledged,
    setAcknowledged,
    canSave,
    // actions
    handleConfirm,
  };
}

export type UseGoalPaceEditorReturn = ReturnType<typeof useGoalPaceEditor>;
