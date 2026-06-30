/**
 * ENG-855 / make-anything-fit Mode B — distribute-around-anchor band (web).
 *
 * Renders the Plan-tab "if I commit to this meal, here's how the rest of the
 * day shakes out" band beneath a day card. ALL distribution math + body-neutral
 * copy lives in `@/lib/nutrition/distributeAroundAnchor` — this component is
 * presentational only, so the screen-budget-PINNED `MealPlanner.tsx` host stays
 * net-neutral (one import + one `<PlanAnchorBudgetBand />` call site).
 *
 * Gated by `plan_distribute_anchor_v1` (DEFAULT-ON, ENG-1279) at the host. The
 * mobile twin is `apps/mobile/components/plan/PlanAnchorBudgetBand.tsx`; the two
 * read the SAME shared result/copy so they can't drift.
 *
 * Trust posture: the qualitative branch (low-confidence anchor) shows the
 * "roughly how the rest of the day shakes out" line with NO per-slot numbers —
 * the nutrition-trust rule, end to end. The `tooTight` slots render their honest
 * "barely room" state rather than a fabricated tiny number.
 */
import {
  planDayDistributeAroundAnchor,
  type PlanDayMealLike,
} from "../../../lib/nutrition/distributeAroundAnchor";
import type { MacroTargets } from "../../../lib/nutrition/remainingMacros";

export type PlanAnchorBudgetBandProps = {
  /** Flag gate (`plan_distribute_anchor_v1`) — false → render nothing. */
  enabled: boolean;
  /** This plan day's meals (placed + placeholders), in slot order. */
  meals: readonly PlanDayMealLike[];
  /** The day's macro targets, or null when the user has no targets yet. */
  targets: MacroTargets | null;
};

export function PlanAnchorBudgetBand({ enabled, meals, targets }: PlanAnchorBudgetBandProps) {
  // Derivation + math + copy live in the shared selector so the pinned host
  // stays net-neutral (one `<PlanAnchorBudgetBand />` call site, no per-day
  // derivation in the host). Null unless this day has a locked anchor + an open
  // slot, the flag is on, and targets exist.
  const distribution = enabled && targets ? planDayDistributeAroundAnchor(meals, targets) : null;

  // Nothing to plan around (no locked anchor / no open slots) → render nothing.
  if (!distribution || !distribution.copy) return null;
  const { result, copy } = distribution;

  return (
    <div
      data-testid="plan-anchor-budget-band"
      className="mt-3 rounded-xl bg-muted p-3"
    >
      <p className="text-[13px] text-foreground-secondary">{copy}</p>

      {result.kind === "distributed" && !result.anchorLeavesTooLittle ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {result.slots
            // Optional slots (Snacks) keep their budget for suggestion-scoping
            // but are never shown as a named aim — mirrors emptySlotAimKcal.
            .filter((s) => !s.optional)
            .map((s) => (
              <span
                key={s.slot}
                data-testid={`plan-anchor-slot-${s.slot}`}
                className="inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-1 text-[11px] text-muted-foreground tabular-nums"
              >
                <span className="font-medium text-foreground-secondary">{s.slot}</span>
                {s.tooTight ? (
                  <span data-testid={`plan-anchor-slot-tight-${s.slot}`}>barely room</span>
                ) : (
                  <span>{`~${s.calories.toLocaleString()} kcal`}</span>
                )}
              </span>
            ))}
        </div>
      ) : null}
    </div>
  );
}
