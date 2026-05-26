"use client";

/**
 * GoalPaceEditorDialog — post-onboarding "Edit goal & pace" editor (web).
 *
 * The pace step in onboarding promises "You can change this anytime", but
 * until now there was no surface to do so: the Targets Goal card's edit
 * affordance dead-ended at the Profile screen, which has no goal control.
 * This dialog closes that gap (ENG goal-editor, 2026-05-25).
 *
 * It is the web twin of `apps/mobile/components/recap/GoalPaceEditorSheet.tsx`
 * and mirrors the Settings activity-level path (`handleActivityLevelConfirm`):
 *
 *   - Goal-type change → recompute target_calories + ALL FOUR macros via
 *     the shared static formula (`recomputeTargetsFromProfile`), then
 *     persist via the shared `persistRecomputedTargets` helper, which
 *     stamps `target_calories_source = "recompute"` and backfills past-day
 *     snapshots + goal_history.
 *   - goal_weight_kg change → write the column only. Goal weight does NOT
 *     feed TDEE / the budget, so it never recomputes calories.
 *   - If BOTH change in one save, recompute only when goal or plan_pace
 *     actually moved (diff against the loaded values).
 *   - goal → maintain clears plan_pace.
 *   - Safety floor is soft-warn-not-block.
 *
 * Gated behind the `goal-editor` feature flag at the call-site (Targets);
 * the recompute logic itself is not flagged.
 */

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { supabase } from "../../../lib/supabase/browserClient.ts";
import { track } from "../../../lib/analytics/track.ts";
import { AnalyticsEvents } from "../../../lib/analytics/events.ts";
import {
  recomputeTargetsFromProfile,
  type RecomputedTargets,
} from "../../../lib/nutrition/recomputeTargetsForActivity.ts";
import { persistRecomputedTargets } from "../../../lib/nutrition/persistRecomputedTargets.ts";
import { safetyFloorFor } from "../../../lib/onboarding/targets.ts";
import {
  PACE_LABELS,
  type ActivityLevel,
  type NutritionStrategy,
  type PlanPace,
  type Sex,
} from "../../../lib/nutrition/tdee.ts";
import { kgToLb, lbToKg } from "../../../lib/units/imperial.ts";

type DbGoal = "cut" | "maintain" | "bulk";

const GOAL_OPTIONS: { value: DbGoal; label: string; desc: string }[] = [
  { value: "cut", label: "Lose weight", desc: "Eat in a deficit" },
  { value: "maintain", label: "Maintain", desc: "Hold your weight" },
  { value: "bulk", label: "Gain weight", desc: "Eat in a surplus" },
];

const PACE_OPTIONS: PlanPace[] = ["relaxed", "steady", "accelerated", "vigorous"];

/** Map the loaded DB goal string to one of the three canonical options. */
function normalizeGoal(raw: string | null): DbGoal {
  if (raw === "maintain" || raw === "health") return "maintain";
  if (raw === "bulk" || raw === "gain" || raw === "strength") return "bulk";
  return "cut"; // cut / lose / recomp / unknown
}

export type GoalPaceEditorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful save so the parent (Targets / Today) can
   *  reload its live target_calories. */
  onSaved?: () => void;
};

type LoadedProfile = {
  sex: Sex;
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  /** Stored activity level — needed to feed the recompute formula. Not
   *  editable here (Settings owns that); fed through so the recomputed
   *  target matches the user's real maintenance. */
  activityLevel: ActivityLevel;
  goal: DbGoal;
  planPace: PlanPace;
  goalWeightKg: number | null;
  nutritionStrategy: NutritionStrategy | null;
  measurementSystem: "metric" | "imperial";
};

export function GoalPaceEditorDialog({
  open,
  onOpenChange,
  onSaved,
}: GoalPaceEditorDialogProps) {
  const [loading, setLoading] = React.useState(true);
  const [loaded, setLoaded] = React.useState<LoadedProfile | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Working (editable) state.
  const [goal, setGoal] = React.useState<DbGoal>("cut");
  const [planPace, setPlanPace] = React.useState<PlanPace>("steady");
  const [goalWeightInput, setGoalWeightInput] = React.useState("");

  // Load the profile whenever the dialog opens.
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
        .select(
          "sex, age, weight_kg, height_cm, activity_level, goal, plan_pace, goal_weight_kg, nutrition_strategy, measurement_system",
        )
        .eq("id", uid)
        .maybeSingle();
      if (cancelled) return;
      const row = (data ?? {}) as Record<string, unknown>;
      const sex: Sex =
        row.sex === "male" || row.sex === "female" ? row.sex : "unspecified";
      const w = typeof row.weight_kg === "number" ? row.weight_kg : null;
      const h = typeof row.height_cm === "number" ? row.height_cm : null;
      const a = typeof row.age === "number" ? row.age : null;
      const al: ActivityLevel =
        row.activity_level === "sedentary" ||
        row.activity_level === "light" ||
        row.activity_level === "moderate" ||
        row.activity_level === "active" ||
        row.activity_level === "very_active"
          ? row.activity_level
          : "moderate";
      const g = normalizeGoal(typeof row.goal === "string" ? row.goal : null);
      const pp =
        row.plan_pace === "relaxed" ||
        row.plan_pace === "steady" ||
        row.plan_pace === "accelerated" ||
        row.plan_pace === "vigorous"
          ? (row.plan_pace as PlanPace)
          : "steady";
      const gw = typeof row.goal_weight_kg === "number" ? row.goal_weight_kg : null;
      const ns =
        row.nutrition_strategy === "balanced" ||
        row.nutrition_strategy === "high_protein" ||
        row.nutrition_strategy === "high_satisfaction" ||
        row.nutrition_strategy === "low_carb"
          ? (row.nutrition_strategy as NutritionStrategy)
          : null;
      const ms = row.measurement_system === "imperial" ? "imperial" : "metric";

      const profile: LoadedProfile = {
        sex,
        weightKg: w,
        heightCm: h,
        age: a,
        activityLevel: al,
        goal: g,
        planPace: pp,
        goalWeightKg: gw,
        nutritionStrategy: ns,
        measurementSystem: ms,
      };
      setLoaded(profile);
      setGoal(g);
      setPlanPace(pp);
      setGoalWeightInput(
        gw == null
          ? ""
          : ms === "imperial"
            ? String(Math.round(kgToLb(gw) * 10) / 10)
            : String(Math.round(gw * 10) / 10),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const weightUnit = loaded?.measurementSystem === "imperial" ? "lb" : "kg";

  // Parse the goal-weight input back to kg (null when blank/invalid).
  const goalWeightKg = React.useMemo<number | null>(() => {
    const t = goalWeightInput.trim();
    if (t === "") return null;
    const n = Number(t);
    if (!Number.isFinite(n) || n <= 0) return null;
    return loaded?.measurementSystem === "imperial"
      ? Math.round(lbToKg(n) * 10) / 10
      : Math.round(n * 10) / 10;
  }, [goalWeightInput, loaded?.measurementSystem]);

  // Did goal or pace actually change? Drives whether we recompute.
  // maintain ignores pace for the diff (pace is cleared on maintain).
  const goalOrPaceChanged = React.useMemo(() => {
    if (!loaded) return false;
    if (goal !== loaded.goal) return true;
    if (goal === "maintain") return false;
    return planPace !== loaded.planPace;
  }, [loaded, goal, planPace]);

  const goalWeightChanged = React.useMemo(() => {
    if (!loaded) return false;
    const a = loaded.goalWeightKg;
    if (a == null && goalWeightKg == null) return false;
    if (a == null || goalWeightKg == null) return true;
    return Math.abs(a - goalWeightKg) > 0.05;
  }, [loaded, goalWeightKg]);

  const dirty = goalOrPaceChanged || goalWeightChanged;

  // Live preview of the recomputed target — only when goal/pace changed
  // AND we have the body basics. goal-weight-only edits show no preview
  // (calories don't move).
  const preview = React.useMemo<RecomputedTargets | null>(() => {
    if (!loaded || !goalOrPaceChanged) return null;
    if (loaded.weightKg == null || loaded.heightCm == null || loaded.age == null) {
      return null;
    }
    return recomputeTargetsFromProfile({
      sex: loaded.sex,
      weightKg: loaded.weightKg,
      heightCm: loaded.heightCm,
      age: loaded.age,
      activityLevel: loaded.activityLevel,
      goal,
      planPace: goal === "maintain" ? null : planPace,
      nutritionStrategy: loaded.nutritionStrategy,
    });
  }, [loaded, goal, planPace, goalOrPaceChanged]);

  const belowSafetyFloor =
    preview != null &&
    (goal === "cut") &&
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

      // Build the non-derived profile columns the editor owns.
      const profileUpdate: Record<string, unknown> = {};
      if (goal !== loaded.goal) profileUpdate.goal = goal;
      // plan_pace: set on a directional goal, cleared on maintain.
      if (goal === "maintain") {
        if (loaded.goal !== "maintain") profileUpdate.plan_pace = null;
      } else if (goalOrPaceChanged) {
        profileUpdate.plan_pace = planPace;
      }
      if (goalWeightChanged) profileUpdate.goal_weight_kg = goalWeightKg;

      // Recompute ONLY when goal or pace changed. goal-weight-only edits
      // pass recomputed=null → no calorie/macro/provenance write.
      const recomputed = goalOrPaceChanged ? preview : null;

      const result = await persistRecomputedTargets(supabase, uid, {
        profileUpdate,
        recomputed,
        source: "recompute",
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
          newPlanPace: goal === "maintain" ? null : planPace,
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
    planPace,
    goalOrPaceChanged,
    goalWeightChanged,
    goalWeightKg,
    preview,
    belowSafetyFloor,
    onSaved,
    onOpenChange,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-card border-border max-w-lg"
        data-testid="goal-pace-editor-dialog"
      >
        <DialogHeader>
          <DialogTitle className="text-foreground">Edit goal &amp; pace</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Changing your goal or pace updates your daily calorie target and
            macros. Your goal weight is used for projections only.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading your plan…
          </div>
        ) : (
          <div className="py-2 space-y-5">
            {/* Goal type */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-2">
                Goal
              </p>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Goal">
                {GOAL_OPTIONS.map((opt) => {
                  const selected = goal === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setGoal(opt.value)}
                      data-testid={`goal-option-${opt.value}`}
                      className={`text-left rounded-xl border p-3 transition-colors ${
                        selected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background hover:border-primary/40"
                      }`}
                    >
                      <span className="block text-[13px] font-semibold text-foreground">
                        {opt.label}
                      </span>
                      <span className="block text-[11px] text-muted-foreground mt-0.5">
                        {opt.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pace — hidden on maintain (pace does not apply) */}
            {goal !== "maintain" ? (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-2">
                  Pace
                </p>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Pace">
                  {PACE_OPTIONS.map((p) => {
                    const selected = planPace === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setPlanPace(p)}
                        data-testid={`pace-option-${p}`}
                        className={`text-left rounded-xl border p-3 transition-colors ${
                          selected
                            ? "border-primary bg-primary/10"
                            : "border-border bg-background hover:border-primary/40"
                        }`}
                      >
                        <span className="block text-[13px] font-semibold text-foreground">
                          {PACE_LABELS[p].title}
                        </span>
                        <span className="block text-[11px] text-muted-foreground mt-0.5">
                          {PACE_LABELS[p].desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Goal weight */}
            <div>
              <label
                htmlFor="goal-weight-input"
                className="block text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-2"
              >
                Goal weight ({weightUnit})
              </label>
              <input
                id="goal-weight-input"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.1"
                value={goalWeightInput}
                onChange={(e) => setGoalWeightInput(e.target.value)}
                data-testid="goal-weight-input"
                placeholder={`Target weight in ${weightUnit}`}
                className="ph-mask w-full rounded-xl border border-border bg-background px-3 py-2 text-[15px] text-foreground tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Used for your projected reach-date only — it doesn&apos;t change
                your calorie target.
              </p>
            </div>

            {/* Live preview of the recomputed target */}
            {preview ? (
              <div
                data-testid="goal-pace-editor-preview"
                className="rounded-xl border border-border bg-background p-4"
              >
                <p className="text-[22px] font-bold text-foreground tabular-nums leading-none">
                  {preview.target_calories.toLocaleString()} kcal
                </p>
                <p className="text-[12px] text-muted-foreground tabular-nums mt-1.5">
                  Protein {preview.target_protein}g · Carbs {preview.target_carbs}g
                  · Fat {preview.target_fat}g · Fibre {preview.target_fiber_g}g
                </p>
              </div>
            ) : null}

            {/* Soft-warn below the safety floor — never blocks Save */}
            {belowSafetyFloor ? (
              <div
                role="alert"
                data-testid="goal-pace-editor-safety-warn"
                className="rounded-xl border border-warning/40 bg-warning/10 px-3.5 py-2.5"
              >
                <p className="text-[12px] text-foreground leading-snug">
                  This pace lands below the general safety floor for unsupervised
                  dieting. Consider a gentler pace, or check in with a clinician.
                </p>
              </div>
            ) : null}

            {error ? (
              <p className="text-[13px] text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!dirty || saving || loading}
            aria-disabled={!dirty || saving || loading}
            data-testid="goal-pace-editor-save"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default GoalPaceEditorDialog;
