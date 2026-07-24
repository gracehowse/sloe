/**
 * Plan empty-week ghost pieces. Three exports, two audiences:
 *
 * ENG-1372 (empty-state grammar) — web LEGACY grid variant
 * (`MealPlanner.tsx`'s 7-column kanban, live whenever `sloe_v3_plan` is off):
 *
 *   - `PlanGhostSlotPill` — an empty kanban cell collapsed to a whisper-weight
 *     pill (slot name only, no icon/eyebrow/"Aim ~X kcal" line, no card fill)
 *     when the WHOLE WEEK has zero real meals. The per-slot Aim number that
 *     normally repeats in every empty cell is derived noise at this point
 *     (law 3) — {@link PlanWeekAimLegend} states it once instead.
 *   - `PlanWeekAimLegend` — the "Aim ~475/570/665" triple, rendered ONCE
 *     above the grid (not ×7), so the guidance survives without repeating.
 *
 * Design-consistency pass (2026-07-24) — the v3 Plan surfaces
 * (`PlanV3Surface` / `PlanV3WebDashboard`):
 *
 *   - `PlanGhostWeekGrid` — the ghosted week that fills the dead space under
 *     `PlanEmptyWeekCard`. The desktop empty Plan was a top-anchored card over
 *     ~700px of void; a person could not see what "Generate this week"
 *     actually produces. This draws the shape of it — the real seven dates,
 *     each with one ghost pill per slot the generator will fill.
 *
 * All three are gated by the host — they carry no flag logic themselves.
 *
 * Mobile twin of `PlanGhostWeekGrid`:
 * `apps/mobile/components/plan/PlanGhostWeekGrid.tsx`.
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

const GHOST_WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export interface PlanGhostWeekGridProps {
  /** The REAL week the generator will fill — labels derive from these dates,
   *  never from an invented Mon–Sun. */
  weekDates: Date[];
  /** The slots the generator will fill, in order (the plan's own slot count,
   *  sliced from `ALL_MEAL_SLOTS` — not a hard-coded three). */
  slots: readonly string[];
}

/**
 * The ghosted week under the empty-week invitation — "here is the shape of
 * what Generate produces". Seven day cells, each holding one quiet pill per
 * meal slot.
 *
 * Deliberately non-interactive: tapping a ghost would promise a per-slot add
 * flow that the empty state has explicitly deferred to "or add meals as you
 * go" (which mounts the real, tappable dashed slots). It is one `role="img"`
 * to assistive tech — 28 individually-announced ghost pills would be noise,
 * so the whole preview speaks once, in a sentence.
 *
 * Responsive by design, not by accident: a row per day at phone width (what
 * mobile renders), a true seven-column week grid at `lg` where the void it
 * exists to fill actually is.
 */
export function PlanGhostWeekGrid({ weekDates, slots }: PlanGhostWeekGridProps) {
  if (weekDates.length === 0 || slots.length === 0) return null;
  const slotWords = slots.map((s) => s.toLowerCase()).join(", ");
  return (
    <div
      role="img"
      aria-label={`Preview of a generated week: ${weekDates.length} days, each with ${slotWords}.`}
      data-testid="plan-ghost-week-grid"
      className="mt-4 grid grid-cols-1 gap-2 lg:grid-cols-7 lg:gap-3"
    >
      {weekDates.map((date, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-dashed border-border p-3 lg:flex-col lg:items-stretch lg:gap-2"
        >
          <span className="w-10 shrink-0 text-[11px] font-semibold uppercase tracking-[0.05em] text-foreground-tertiary lg:w-auto">
            {GHOST_WEEKDAY[date.getDay()]}
          </span>
          <div className="flex min-w-0 flex-1 gap-2 lg:w-full lg:flex-col">
            {slots.map((slot) => (
              <span
                key={slot}
                className="min-w-0 flex-1 truncate rounded-lg bg-muted px-2 py-2 text-center text-[11px] font-medium text-foreground-tertiary"
              >
                {slot}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
