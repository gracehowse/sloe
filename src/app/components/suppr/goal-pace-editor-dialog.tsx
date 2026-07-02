"use client";

/**
 * GoalPaceEditorDialog — post-onboarding "Edit goal & pace" editor (web).
 *
 * The pace step in onboarding promises "You can change this anytime", but
 * until now there was no surface to do so: the Targets Goal card's edit
 * affordance dead-ended at the Profile screen, which has no goal control.
 * This dialog closes that gap (ENG goal-editor, 2026-05-25).
 *
 * It is the web twin of `apps/mobile/components/recap/GoalPaceEditorSheet.tsx`.
 * All load / derive / persist logic lives in `useGoalPaceEditorDialog`
 * (composition-root hook) — the mobile twin is `useGoalPaceEditor`. Both
 * call the same shared helpers (`@/lib/nutrition/goalEditorPace`) so web +
 * mobile can't drift.
 *
 * ── Stage 2 (target-recompute unification, 2026-05-26) ───────────────
 *   - ADAPTIVE maintenance: the live preview is computed off the
 *     profile's adaptive_tdee when it's confident + fresh (else static
 *     Mifflin), matching the rest of the app. The amber floor notice
 *     reads off that adaptive-based preview target.
 *   - CONTINUOUS pace slider (`BrandedSlider`, onboarding parity), seated
 *     from `pace_kg_per_week` (else the legacy `plan_pace` preset).
 *     Dirty-tracking diffs against the seated continuous value, so
 *     opening + saving unchanged never moves the target.
 *   - WEIGHT + HEIGHT editable here and fed into the recompute.
 *
 * Posture (unchanged): goal/pace/weight/height → recompute + provenance
 * "recompute"; goal-weight-only → column write; goal → maintain clears
 * plan_pace; safety floor is soft-warn-not-block. Fibre is editable inline
 * here (ENG-846); per-macro overrides beyond fibre stay on /profile —
 * reachable via "Customise macros" (`onCustomiseMacros`). Gated behind
 * `goal-editor` at the call-site.
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
import { BrandedSlider } from "../onboarding/branded-slider";
import {
  SAFETY_ACK_TITLE,
  SAFETY_ACK_CONFIRM_LABEL,
  safetyAckBody,
  type EditorDbGoal,
} from "../../../lib/nutrition/goalEditorPace.ts";
import { type DayTargetScheduleId } from "../../../lib/nutrition/dayTargetSchedule.ts";
import { useGoalPaceEditorDialog } from "./useGoalPaceEditorDialog.ts";

const GOAL_OPTIONS: { value: EditorDbGoal; label: string; desc: string }[] = [
  { value: "cut", label: "Lose weight", desc: "Eat in a deficit" },
  { value: "maintain", label: "Maintain", desc: "Hold your weight" },
  { value: "bulk", label: "Gain weight", desc: "Eat in a surplus" },
];

// ENG-960 — opt-in day-target schedule presets. "same" clears the schedule.
const SCHEDULE_OPTIONS: {
  value: DayTargetScheduleId | "same";
  label: string;
  desc: string;
}[] = [
  { value: "same", label: "Same every day", desc: "One steady target" },
  { value: "weekend_lift", label: "More at weekends", desc: "Higher Sat/Sun" },
  { value: "lighter_weekdays", label: "Lighter weekdays", desc: "Bigger weekends" },
];

const ACCENT_BY_SLIDER_GOAL: Record<string, string> = {
  lose: "var(--macro-fat)",
  gain: "var(--macro-protein)",
  recomp: "var(--macro-carbs)",
  maintain: "var(--macro-fat)",
};

export type GoalPaceEditorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful save so the parent (Targets / Today) can
   *  reload its live target_calories. */
  onSaved?: () => void;
  /** Navigate to the manual /profile macro editor (fibre + per-macro
   *  overrides live there). When omitted, the link is hidden. */
  onCustomiseMacros?: () => void;
};

export function GoalPaceEditorDialog({
  open,
  onOpenChange,
  onSaved,
  onCustomiseMacros,
}: GoalPaceEditorDialogProps) {
  const e = useGoalPaceEditorDialog({ open, onOpenChange, onSaved });

  const inputCls =
    "w-full rounded-xl border border-border bg-background px-3 py-2 text-[15px] text-foreground tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40";
  const sectionCls =
    "text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-2";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-card border-border max-w-lg max-h-[88vh] overflow-y-auto"
        data-testid="goal-pace-editor-dialog"
      >
        <DialogHeader>
          <DialogTitle className="text-foreground">Edit goal &amp; pace</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Changing your goal, pace, weight, or height updates your daily calorie
            target and macros. Your goal weight is used for projections only.
          </DialogDescription>
        </DialogHeader>

        {e.loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading your plan…
          </div>
        ) : (
          <div className="py-2 space-y-5">
            {/* Goal type */}
            <div>
              <p className={sectionCls}>Goal</p>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Goal">
                {GOAL_OPTIONS.map((opt) => {
                  const selected = e.goal === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => e.onChangeGoal(opt.value)}
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

            {/* Pace — continuous slider, hidden on maintain */}
            {e.goal !== "maintain" ? (
              <div data-testid="goal-pace-editor-pace-slider">
                <p className={sectionCls}>Pace</p>
                <div className="bg-background border border-border rounded-xl p-4">
                  <div className="flex items-baseline gap-1.5 mb-2.5">
                    {/* SLOE Phase 0: the pace kg/week hero numeral reads in the
                        Newsreader serif display face; the unit stays sans.
                        Mirrors mobile GoalPaceSlider. */}
                    <span className="font-[family-name:var(--font-headline)] text-[28px] font-medium tracking-tight tabular-nums leading-none text-foreground">
                      {e.pace.toFixed(e.pace < 0.1 ? 3 : 2)}
                    </span>
                    <span className="text-sm font-semibold text-muted-foreground">
                      kg / week
                    </span>
                  </div>
                  <BrandedSlider
                    value={e.pace}
                    onChange={e.setPace}
                    min={e.sliderRange.min}
                    max={e.sliderRange.max}
                    step={e.sliderRange.step}
                    accent={ACCENT_BY_SLIDER_GOAL[e.sliderGoal] ?? "var(--macro-fat)"}
                    ariaLabel="Weekly rate"
                    formatBubble={(v) => `${v.toFixed(2)} kg / wk`}
                  />
                  <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground tabular-nums">
                    <span>{e.sliderRange.min} kg / wk</span>
                    <span>{e.sliderRange.max} kg / wk</span>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Current weight + height */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="gpe-weight" className={sectionCls}>
                  Current weight ({e.weightUnit})
                </label>
                <input
                  id="gpe-weight"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.1"
                  value={e.weightInput}
                  onChange={(ev) => e.setWeightInput(ev.target.value)}
                  data-testid="goal-pace-editor-weight-input"
                  placeholder={`Weight in ${e.weightUnit}`}
                  className={`ph-mask ${inputCls}`}
                />
              </div>
              <div>
                <p className={sectionCls}>
                  Height ({e.measurementSystem === "imperial" ? "ft / in" : "cm"})
                </p>
                {e.measurementSystem === "imperial" ? (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={e.heightFeetInput}
                      onChange={(ev) => e.setHeightFeetInput(ev.target.value)}
                      data-testid="goal-pace-editor-height-feet"
                      placeholder="ft"
                      className={`ph-mask ${inputCls}`}
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={e.heightInchesInput}
                      onChange={(ev) => e.setHeightInchesInput(ev.target.value)}
                      data-testid="goal-pace-editor-height-inches"
                      placeholder="in"
                      className={`ph-mask ${inputCls}`}
                    />
                  </div>
                ) : (
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={e.heightCmInput}
                    onChange={(ev) => e.setHeightCmInput(ev.target.value)}
                    data-testid="goal-pace-editor-height-cm"
                    placeholder="cm"
                    className={`ph-mask ${inputCls}`}
                  />
                )}
              </div>
            </div>

            {/* Goal weight */}
            <div>
              <label htmlFor="goal-weight-input" className={sectionCls}>
                Goal weight ({e.weightUnit})
              </label>
              <input
                id="goal-weight-input"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.1"
                value={e.goalWeightInput}
                onChange={(ev) => e.setGoalWeightInput(ev.target.value)}
                data-testid="goal-weight-input"
                placeholder={`Target weight in ${e.weightUnit}`}
                className={`ph-mask ${inputCls}`}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Used for your projected reach-date only — it doesn&apos;t change
                your calorie target.
              </p>
            </div>

            {/* Fibre goal (ENG-846) — user-owned; sticky across recomputes */}
            <div>
              <label htmlFor="goal-fiber-input" className={sectionCls}>
                Daily fibre (g)
              </label>
              <input
                id="goal-fiber-input"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={e.fiberInput}
                onChange={(ev) => e.setFiberInput(ev.target.value)}
                data-testid="goal-fiber-input"
                placeholder={
                  e.previewFiberG != null
                    ? `Recommended ${e.previewFiberG}g`
                    : "Daily fibre target in grams"
                }
                className={`ph-mask ${inputCls}`}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Your fibre goal stays put when you change pace — unless you edit it
                here.
              </p>
            </div>

            {/* ENG-960 — opt-in day-target schedule (weekly-neutral) */}
            <div>
              <p className={sectionCls}>Calorie schedule</p>
              <div
                className="grid grid-cols-3 gap-2"
                role="radiogroup"
                aria-label="Calorie schedule"
              >
                {SCHEDULE_OPTIONS.map((opt) => {
                  const selected = e.calorieSchedule === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => e.setCalorieSchedule(opt.value)}
                      data-testid={`calorie-schedule-option-${opt.value}`}
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
              <p className="text-[11px] text-muted-foreground mt-1">
                Cycles your daily calories across the week without changing the
                7-day total — your goal pace stays the same.
              </p>
            </div>

            {/* Live preview of the recomputed target (adaptive-aware) */}
            {e.preview ? (
              <div
                data-testid="goal-pace-editor-preview"
                className="rounded-xl border border-border bg-background p-4"
              >
                {/* SLOE Phase 0: the recomputed-target hero kcal reads in the
                    Newsreader serif display face; the `kcal` unit stays sans. */}
                <p className="font-[family-name:var(--font-headline)] text-[22px] font-medium text-foreground tabular-nums leading-none">
                  {e.preview.target_calories.toLocaleString()}
                  <span className="font-sans text-[13px] font-semibold text-muted-foreground"> kcal</span>
                </p>
                <p className="text-[11px] text-muted-foreground tabular-nums mt-1.5">
                  Protein {e.preview.target_protein}g · Carbs {e.preview.target_carbs}g
                  · Fat {e.preview.target_fat}g · Fibre{" "}
                  {e.previewFiberG ?? e.preview.target_fiber_g}g
                </p>
              </div>
            ) : null}

            {/* Below the safety floor — soft-warn AND acknowledge-to-proceed
                (ENG-1027, Cronometer pattern). The warning explains; the
                checkbox is the explicit, honest confirmation required before
                Save unlocks. Body-neutral, no shaming. */}
            {e.belowSafetyFloor ? (
              <div
                role="alert"
                data-testid="goal-pace-editor-safety-warn"
                className="rounded-xl border border-warning/40 bg-warning/10 px-3.5 py-3 space-y-2"
              >
                <p className="text-[11px] font-bold text-foreground leading-snug">
                  {SAFETY_ACK_TITLE}
                </p>
                <p className="text-[11px] text-foreground leading-snug">
                  {safetyAckBody(e.safetyFloorKcal)}
                </p>
                <label className="flex items-start gap-2 cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    checked={e.acknowledged}
                    onChange={(ev) => e.setAcknowledged(ev.target.checked)}
                    data-testid="goal-pace-editor-safety-ack"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-[var(--warning)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning/50"
                  />
                  <span className="text-[11px] font-semibold text-foreground leading-snug">
                    {SAFETY_ACK_CONFIRM_LABEL}
                  </span>
                </label>
              </div>
            ) : null}

            {/* Customise macros (incl. fibre) → the manual /profile editor. */}
            {onCustomiseMacros ? (
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onCustomiseMacros();
                }}
                data-testid="goal-pace-editor-customise-macros"
                className="flex items-center gap-3 w-full rounded-xl border border-border bg-background hover:bg-accent/30 transition-colors px-3.5 py-3 text-left"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-semibold text-foreground">
                    Customise macros (incl. fibre)
                  </span>
                  <span className="block text-[11px] text-muted-foreground mt-0.5">
                    Set per-macro and fibre targets by hand
                  </span>
                </span>
                <span aria-hidden className="text-muted-foreground">
                  →
                </span>
              </button>
            ) : null}

            {e.error ? (
              <p className="text-[13px] text-destructive" role="alert">
                {e.error}
              </p>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={e.saving}>
            Cancel
          </Button>
          {/* Save (goal & pace) — aubergine OUTLINE (Sloe treatment #1,
              2026-06-08). The everyday primary CTA is an accent line, not a
              filled slab; we override the default filled Button with a
              transparent fill + 1.5px aubergine border + solid label so it
              matches the mobile goal/pace Save. */}
          <Button
            onClick={e.handleSave}
            disabled={!e.dirty || e.saving || e.loading || !e.canSave}
            aria-disabled={!e.dirty || e.saving || e.loading || !e.canSave}
            data-testid="goal-pace-editor-save"
            className="bg-transparent border-[1.5px] border-[var(--accent-primary-solid)] text-primary-solid hover:bg-[var(--accent-primary-soft)] hover:text-primary-solid"
          >
            {e.saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default GoalPaceEditorDialog;
