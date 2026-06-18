/**
 * ENG-1100 — shared empty meal-slot UI for Today + Plan (web).
 *
 * Keeps aim copy, test IDs, and Plan absent-slot chrome in one module so
 * `today-meals-section.tsx` and `MealPlanner.tsx` cannot drift.
 */
import type { LucideIcon } from "lucide-react";
import { aimKcalLabel } from "../../../lib/nutrition/mealSlotAim";

export type EmptyMealSlotSurface = "today" | "plan";

export type EmptyMealSlotAimLineProps = {
  slot: string;
  aimKcal: number;
  surface: EmptyMealSlotSurface;
  /** Plan placeholder rows sit the aim on the macro line (10px). */
  density?: "default" | "compact";
  className?: string;
};

/** Renders "Aim ~X kcal" with the stable per-surface test ID. */
export function EmptyMealSlotAimLine({
  slot,
  aimKcal,
  surface,
  density = "default",
  className,
}: EmptyMealSlotAimLineProps) {
  const testId = surface === "today" ? `today-slot-aim-${slot}` : `plan-slot-aim-${slot}`;
  const resolvedClass =
    className ??
    (surface === "today"
      ? "text-[11px] text-foreground-secondary tabular-nums mt-0.5"
      : density === "compact"
        ? "text-muted-foreground tabular-nums"
        : "text-[11px] text-muted-foreground tabular-nums");

  return (
    <p
      data-testid={testId}
      className={resolvedClass}
      style={surface === "plan" && density === "compact" ? { fontSize: 10 } : undefined}
    >
      {aimKcalLabel(aimKcal)}
    </p>
  );
};

export type PlanAbsentMealSlotRowProps = {
  slot: string;
  SlotIcon: LucideIcon;
  aimKcal: number | null;
};

/** Plan day-card cell when a canonical slot has no row yet. */
export function PlanAbsentMealSlotRow({ slot, SlotIcon, aimKcal }: PlanAbsentMealSlotRowProps) {
  return (
    <div className="rounded-xl bg-muted relative p-2.5">
      <p
        className="text-muted-foreground uppercase inline-flex items-center gap-1.5"
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.1em",
          marginBottom: 4,
        }}
      >
        <SlotIcon size={11} aria-hidden />
        {slot}
      </p>
      {aimKcal != null ? (
        <EmptyMealSlotAimLine slot={slot} aimKcal={aimKcal} surface="plan" />
      ) : (
        <p className="text-[11px] text-muted-foreground tabular-nums">Empty slot</p>
      )}
    </div>
  );
}
