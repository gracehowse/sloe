import { useMemo, useState } from "react";

import { ALL_MEAL_SLOTS } from "@/lib/mealPlanAlgo";
import {
  computePlanDayStatus,
  type PlanWeekVerdict,
} from "@suppr/shared/planning/planWeekStatus";
import type { DayPlan } from "@/lib/types";
import { PlanHeaderV3 } from "./PlanHeaderV3";
import {
  PlanWeekStripV3,
  type PlanWeekStripDay,
} from "./PlanWeekStripV3";
import { PlanDayDetailBandV3 } from "./PlanDayDetailBandV3";
import {
  PlanHouseholdBannerV3,
  type PlanHouseholdBannerV3Props,
} from "./PlanHouseholdBannerV3";

const WEEKDAY_LETTER = ["S", "M", "T", "W", "T", "F", "S"] as const;
const WEEKDAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/**
 * PlanV3Surface — the Sloe v3 Plan top section (ENG-1225 Block 2): header +
 * verdict, week-strip day selector, optional household banner, and the selected
 * day's calorie-band detail. Composed from the Plan v3 components; the host
 * (planner.tsx) passes the real week plan + targets + dates so this stays a thin
 * integration (keeps the pinned planner lean). The per-slot meal cards +
 * meal-filter across-week view are Block 3.
 */
export interface PlanV3SurfaceProps {
  /** The week plan (one entry per day), or null before a plan exists. */
  plan: DayPlan[] | null;
  /** Daily calorie target (planTargets.calories). */
  targetKcal: number;
  /** One Date per plan day (host-computed via the plan calendar anchor). */
  weekDates: Date[];
  /** "16–22 June" overline. */
  weekLabel: string;
  /** Completeness verdict (computePlanWeekVerdict), or null. */
  verdict: PlanWeekVerdict | null;
  /** Household banner data, or null to hide it (solo / data unavailable). */
  household: Omit<PlanHouseholdBannerV3Props, "onPress"> | null;
  onGenerate: () => void;
  onAdjust: () => void;
  onTemplates: () => void;
  onOpenHousehold: () => void;
  /** Today (for the week-strip highlight) — injected for deterministic tests. */
  today?: Date;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function PlanV3Surface({
  plan,
  targetKcal,
  weekDates,
  weekLabel,
  verdict,
  household,
  onGenerate,
  onAdjust,
  onTemplates,
  onOpenHousehold,
  today,
}: PlanV3SurfaceProps) {
  // Default the selected day to today (when it falls in the week), else day 0.
  const todayIndex = useMemo(() => {
    const t = today ?? new Date();
    const i = weekDates.findIndex((d) => isSameDay(d, t));
    return i >= 0 ? i : 0;
  }, [weekDates, today]);
  const [selectedIndex, setSelectedIndex] = useState(todayIndex);
  const safeIndex = Math.min(selectedIndex, Math.max(weekDates.length - 1, 0));

  const days: PlanWeekStripDay[] = useMemo(
    () =>
      weekDates.map((date, i) => {
        const meals = plan?.[i]?.meals ?? [];
        const status = computePlanDayStatus(
          meals.map((m, j) => ({
            slot: ALL_MEAL_SLOTS[j] ?? "Snacks",
            kcal: m.calories,
            empty: m.isPlaceholder,
          })),
        );
        return {
          key: String(i),
          dayLetter: WEEKDAY_LETTER[date.getDay()] ?? "?",
          dateNum: date.getDate(),
          status,
          isToday: today ? isSameDay(date, today) : i === todayIndex,
        };
      }),
    [weekDates, plan, today, todayIndex],
  );

  const selectedDay = plan?.[safeIndex] ?? null;
  const selectedDate = weekDates[safeIndex];
  const dayLabel = selectedDate
    ? `${WEEKDAY_LONG[selectedDate.getDay()] ?? "Day"} ${selectedDate.getDate()}`
    : "";
  const plannedCount =
    selectedDay?.meals.filter((m) => !m.isPlaceholder).length ?? 0;
  const totals = selectedDay?.totals;

  return (
    <>
      <PlanHeaderV3
        dateRangeLabel={weekLabel}
        verdict={verdict}
        onGenerate={onGenerate}
        onAdjust={onAdjust}
        onTemplates={onTemplates}
      />
      <PlanWeekStripV3
        days={days}
        selectedKey={String(safeIndex)}
        onSelectDay={(key) => setSelectedIndex(Number(key))}
      />
      {household ? (
        <PlanHouseholdBannerV3 {...household} onPress={onOpenHousehold} />
      ) : null}
      <PlanDayDetailBandV3
        dayLabel={dayLabel}
        dayTotalKcal={Math.round(totals?.calories ?? 0)}
        targetKcal={targetKcal}
        plannedCount={plannedCount}
        cookedCount={0}
        macros={
          totals
            ? {
                protein: totals.protein,
                carbs: totals.carbs,
                fat: totals.fat,
              }
            : null
        }
      />
    </>
  );
}

export default PlanV3Surface;
