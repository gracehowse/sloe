"use client";

import { buildMaintenanceChain } from "../../../lib/nutrition/maintenanceChain.ts";
import type { ResolvedMaintenance } from "../../../lib/nutrition/resolveMaintenance.ts";
import type { PlanPace, Sex, ActivityLevel } from "../../../lib/nutrition/tdee.ts";

/**
 * G-4 (2026-04-19, TestFlight `ALcwMFPjfmJvyBLjs4CRt1k`) — Maintenance card's
 * "How this works" expandable. Shows the chain BMR → Maintenance → Calorie goal
 * → projected weekly loss so the user can see how every number is derived. No
 * new DB reads — numbers come from the same state the card already holds.
 *
 * Extracted from `ProgressDashboard` (ENG-953 touch) to keep that legacy screen
 * under its line budget while a new sibling card lands. Behaviour-preserving:
 * same chain, same collapsed-by-default toggle, same testids. Parity: mobile
 * `(tabs)/progress.tsx` renders the identical expandable inline.
 */
export function MaintenanceExplainer({
  sex,
  weightKg,
  heightCm,
  age,
  activityLevel,
  resolved,
  planPace,
  userGoal,
  goalCalories,
  open,
  onToggle,
}: {
  sex: Sex;
  weightKg: number | null;
  heightCm: number;
  age: number;
  activityLevel: ActivityLevel;
  resolved: ResolvedMaintenance;
  planPace: PlanPace;
  userGoal: string | null;
  goalCalories: number;
  open: boolean;
  onToggle: () => void;
}) {
  const chain = buildMaintenanceChain(
    {
      sex,
      weight_kg: weightKg ?? 70,
      height_cm: heightCm,
      age,
      activity_level: activityLevel,
    },
    resolved,
    planPace,
    userGoal,
    goalCalories,
  );
  if (!chain) return null;

  return (
    <div className="mt-3 pt-3 border-t border-border" data-testid="maintenance-explainer">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-xs font-semibold text-primary-solid hover:underline"
      >
        <span>{open ? "Hide" : "How this works"}</span>
        <span aria-hidden="true" className="text-[10px]">
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open && (
        <dl className="mt-3 space-y-1.5">
          {chain.steps.map((step, i) => (
            <div
              key={`${step.kind}-${i}`}
              className="flex items-baseline justify-between gap-3 text-xs"
            >
              <dt
                className={
                  step.kind === "summary" || step.kind === "weeklyLoss"
                    ? "text-muted-foreground leading-snug"
                    : step.emphasis
                    ? "font-semibold text-foreground"
                    : "text-foreground"
                }
              >
                {step.label}
              </dt>
              {step.value && (
                <dd
                  className={`tabular-nums ${step.emphasis ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                >
                  {step.value}
                </dd>
              )}
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export default MaintenanceExplainer;
