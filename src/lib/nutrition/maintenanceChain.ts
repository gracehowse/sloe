/**
 * maintenanceChain — pure helper that assembles the "How this works" step
 * list for the Progress → Maintenance card (G-4, 2026-04-19, TestFlight
 * `ALcwMFPjfmJvyBLjs4CRt1k`).
 *
 * Tester feedback: the Maintenance card shows the adaptive number and a
 * one-line caption, but doesn't connect the dots to the user's calorie
 * goal, daily deficit, and projected weekly loss. The expandable chain
 * renders, in order:
 *
 *   1. BMR (resting burn)                    — `calculateBMR()`
 *   2. × activity multiplier                 — `ACTIVITY_MULTIPLIERS[level]`
 *   3. + adaptive adjustment (if in effect)  — resolved.kcal − formulaKcal
 *   4. = Maintenance                         — resolved.kcal
 *   5. − plan deficit                        — derived from planPace + goal
 *   6. = Calorie goal                        — `calculateBudget()`
 *   7. Below-maintenance summary             — resolved.kcal − budget
 *   8. Projected weekly loss (kg)            — 7 × deficit / 7700
 *
 * Rules (locked, tested):
 *   - When adaptive confidence is `low` OR adaptive source did not win
 *     (branch is formula), the `+ adaptive adjustment` step is omitted
 *     and `= Maintenance` equals the formula total. The chain never
 *     fabricates a delta.
 *   - If the formula inputs are incomplete (any of sex / weight / height /
 *     age / activity missing), returns `null`. The caller renders nothing.
 *   - If the plan budget cannot be computed for any reason, the deficit /
 *     goal / projected-loss rows are omitted. We never invent a deficit.
 *
 * Shared between web (`ProgressDashboard.tsx`) and mobile
 * (`app/(tabs)/progress.tsx`). Structural parity pinned by
 * `tests/unit/maintenanceChain.test.ts`.
 */

import {
  ACTIVITY_MULTIPLIERS,
  ACTIVITY_SHORT_LABELS,
  calculateBMR,
  calculateBudget,
  type ActivityLevel,
  type PlanPace,
  type Sex,
} from "./tdee";
import type { ResolvedMaintenance } from "./resolveMaintenance";

/** 7700 kcal ≈ 1 kg of body fat — the standard conversion used across the app. */
export const KCAL_PER_KG_FAT = 7700;

/**
 * Convert a weekly calorie deficit to kg of body fat.
 *
 * Single source for any "you're projected to lose X kg/week" surface.
 * Use absolute weekDeficit; sign is the caller's job to surface (deficit
 * vs surplus). Returns 0 for non-finite or zero input — no NaN leaks.
 *
 * 2026-05-05 — replaces the per-surface `weekDeficit / 3500 * 0.4536`
 * pattern that was drifting ~0.2% from the 7700-basis used in onboarding
 * pace promises, why-this-number explainer, and weight projection.
 */
export function weekDeficitToKg(weekDeficit: number): number {
  if (!Number.isFinite(weekDeficit)) return 0;
  return Math.abs(weekDeficit) / KCAL_PER_KG_FAT;
}

export type ChainStepKind =
  | "bmr"
  | "activity"
  | "adaptive"
  | "maintenance"
  | "deficit"
  | "goal"
  | "summary"
  | "weeklyLoss";

export interface ChainStep {
  kind: ChainStepKind;
  /** Short label rendered as the row's prefix. */
  label: string;
  /** Right-hand numeric readout (e.g. "1,355 kcal"). Empty for summary rows. */
  value: string;
  /** Optional small grey parenthetical beneath / beside the label. */
  detail?: string;
  /** Mark the = lines so the UI can render them bold. */
  emphasis?: boolean;
}

export interface MaintenanceChainResult {
  steps: ChainStep[];
  /** Positive when cutting, negative when bulking, 0 when maintaining. Null when undetermined. */
  weeklyLossKg: number | null;
  /** The daily kcal below Maintenance implied by the budget. Null when no budget is resolvable. */
  dailyDeficitKcal: number | null;
  /** The budget kcal used to derive the deficit (surface in a test). */
  budgetKcal: number | null;
}

export interface MaintenanceChainProfile {
  sex?: Sex | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  age?: number | null;
  activity_level?: ActivityLevel | null;
}

function isFinitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function formatKcal(n: number): string {
  return `${Math.round(n).toLocaleString()} kcal`;
}

/**
 * Build the explainer chain. `resolved` must come from `resolveMaintenance`
 * so the Maintenance total used here always matches what's shown on the
 * card above — a drift between the two would be a silent UX bug.
 */
export function buildMaintenanceChain(
  profile: MaintenanceChainProfile,
  resolved: ResolvedMaintenance,
  planPace: PlanPace,
  goal: string | null | undefined,
): MaintenanceChainResult | null {
  if (
    !profile.sex ||
    !isFinitePositive(profile.weight_kg) ||
    !isFinitePositive(profile.height_cm) ||
    !isFinitePositive(profile.age)
  ) {
    return null;
  }

  const activity: ActivityLevel = profile.activity_level ?? "sedentary";
  const multiplier = ACTIVITY_MULTIPLIERS[activity];
  const activityLabel = ACTIVITY_SHORT_LABELS[activity];

  const bmr = calculateBMR(
    profile.sex,
    profile.weight_kg,
    profile.height_cm,
    profile.age,
  );
  const formulaTdee = Math.round(bmr * multiplier);
  const maintenance = resolved.kcal;

  // Decide whether the adaptive line should appear. We only show it when
  // the adaptive branch actually won on confidence AND the resolver is
  // not in its formula fallback. Confidence === "low" cannot win, so this
  // also transparently handles "skip on low confidence" from the spec.
  const showAdaptiveLine =
    resolved.source === "adaptive" &&
    resolved.formulaKcal != null &&
    resolved.formulaKcal !== maintenance;
  const adaptiveDelta = showAdaptiveLine
    ? maintenance - (resolved.formulaKcal as number)
    : 0;

  const steps: ChainStep[] = [];
  steps.push({
    kind: "bmr",
    label: "Your body at rest (BMR)",
    value: formatKcal(bmr),
  });
  steps.push({
    kind: "activity",
    label: `× activity level (${activityLabel} ${multiplier})`,
    value: formatKcal(formulaTdee),
  });
  if (showAdaptiveLine) {
    const sign = adaptiveDelta >= 0 ? "+" : "−";
    const abs = Math.abs(Math.round(adaptiveDelta));
    steps.push({
      kind: "adaptive",
      label: `+ adaptive adjustment (${sign}${abs} kcal)`,
      value: formatKcal(maintenance),
      detail:
        "Your real burn, learned from your intake + weight changes.",
    });
  }
  steps.push({
    kind: "maintenance",
    label: "= Maintenance",
    value: formatKcal(maintenance),
    emphasis: true,
  });

  // Calorie goal line — derived from pace + goal type. `calculateBudget`
  // handles "cut" / "maintain" / "bulk" (and the onboarding label
  // aliases). `goal` is nullable because older profiles may lack it; in
  // that case we default to the safe-cut branch, matching the budget
  // calculator's existing fallback.
  const goalType = (goal ?? "cut").toString();
  const budget = calculateBudget(maintenance, planPace, goalType);
  const dailyDeficit = maintenance - budget;

  let budgetKcal: number | null = null;
  let dailyDeficitKcal: number | null = null;
  let weeklyLossKg: number | null = null;

  if (Number.isFinite(budget) && budget > 0) {
    budgetKcal = Math.round(budget);
    dailyDeficitKcal = Math.round(dailyDeficit);
    weeklyLossKg = Number(((dailyDeficit * 7) / KCAL_PER_KG_FAT).toFixed(2));

    const absDeficit = Math.abs(dailyDeficit);
    const deficitSign = dailyDeficit >= 0 ? "−" : "+";
    steps.push({
      kind: "deficit",
      label: `${deficitSign} your plan ${dailyDeficit >= 0 ? "deficit" : "surplus"}`,
      value: formatKcal(absDeficit),
    });
    steps.push({
      kind: "goal",
      label: "= Calorie goal",
      value: formatKcal(budget),
      emphasis: true,
    });

    if (Math.abs(dailyDeficit) >= 1) {
      const direction = dailyDeficit > 0 ? "below" : "above";
      steps.push({
        kind: "summary",
        label: `If you hit your goal daily: ~${Math.round(
          Math.abs(dailyDeficit),
        ).toLocaleString()} kcal/day ${direction} Maintenance`,
        value: "",
      });
      const absLoss = Math.abs(weeklyLossKg);
      if (absLoss > 0) {
        const lossLabel = dailyDeficit > 0 ? "Projected weekly loss" : "Projected weekly gain";
        // Action 13 Item #12 (2026-04-19) — caveat the projection.
        // 7700 kcal/kg is correct for **fat mass**, but week-to-week
        // weight readings are dominated by water/glycogen swings —
        // particularly in the first week of a cut/bulk. Surface that
        // honestly so the user doesn't read 0.5 kg/wk as a guarantee
        // and panic on the first +0.4 kg morning. Pinned by
        // `tests/unit/maintenanceChain.test.ts`.
        steps.push({
          kind: "weeklyLoss",
          label: `${lossLabel}: ~${absLoss.toFixed(2)} kg* (*long-term fat ${dailyDeficit > 0 ? "loss" : "gain"}; week-to-week varies with water/glycogen)`,
          value: "",
        });
      }
    }
  }

  return {
    steps,
    weeklyLossKg,
    dailyDeficitKcal,
    budgetKcal,
  };
}
