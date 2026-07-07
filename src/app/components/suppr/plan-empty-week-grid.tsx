/**
 * ENG-1372 (empty-state grammar, Plan empty-week) — web LEGACY grid variant
 * (`MealPlanner.tsx`'s 7-column kanban, live whenever `sloe_v3_plan` is off —
 * currently the only shipped web Plan surface). Two pieces:
 *
 *   - `PlanGhostSlotPill` — an empty kanban cell collapsed to a whisper-weight
 *     pill (slot name only, no icon/eyebrow/"Aim ~X kcal" line, no card fill)
 *     when the WHOLE WEEK has zero real meals. The per-slot Aim number that
 *     normally repeats in every empty cell is derived noise at this point
 *     (law 3) — {@link PlanWeekAimLegend} states it once instead.
 *   - `PlanWeekAimLegend` — the "Aim ~475/570/665" triple, rendered ONCE
 *     above the grid (not ×7), so the guidance survives without repeating.
 *
 * Both are gated by the host on `empty_state_grammar_v1` AND "does the whole
 * week have zero real meals" — neither carries gating logic itself.
 */
import { aimKcalLabel } from "../../../lib/nutrition/mealSlotAim";

export interface PlanGhostSlotPillProps {
  slot: string;
}

/** Whisper-weight empty cell — replaces the normal bg-muted eyebrow+aim card
 *  ONLY when the whole week is empty (a populated-elsewhere week keeps the
 *  per-slot Aim line; that number is still earned context there). */
export function PlanGhostSlotPill({ slot }: PlanGhostSlotPillProps) {
  return (
    <div
      data-testid={`plan-ghost-slot-${slot.toLowerCase()}`}
      className="rounded-xl border border-dashed border-border/60 p-2.5 text-center"
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-foreground-tertiary/70">
        {slot}
      </p>
    </div>
  );
}

export interface PlanWeekAimLegendSlot {
  slot: string;
  aimKcal: number;
}

export interface PlanWeekAimLegendProps {
  slots: PlanWeekAimLegendSlot[];
}

/** Renders the per-slot "Aim ~X kcal" guidance ONCE, above the grid, instead
 *  of repeating in every one of the week's empty cells. */
export function PlanWeekAimLegend({ slots }: PlanWeekAimLegendProps) {
  if (slots.length === 0) return null;
  return (
    <div
      data-testid="plan-week-aim-legend"
      className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground"
    >
      {slots.map(({ slot, aimKcal }) => (
        <span key={slot} className="tabular-nums">
          <span className="font-semibold text-foreground-secondary">{slot}</span>{" "}
          {aimKcalLabel(aimKcal)}
        </span>
      ))}
    </div>
  );
}
