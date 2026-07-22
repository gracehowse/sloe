import type { WeightGoalTimeline } from "@/lib/weightProjection";
import type { ProgressHierarchyV1Props } from "./ProgressHierarchyV1";

type Meal = { calories?: number | null };

function buildByDay(count: number, kcal: number): Record<string, Meal[]> {
  const out: Record<string, Meal[]> = {};
  for (let i = 0; i < count; i++) {
    out[`2026-07-${String(i + 1).padStart(2, "0")}`] = [{ calories: kcal }];
  }
  return out;
}

export const hierarchyTimeline: WeightGoalTimeline = {
  daysToGoal: 77,
  daysToGoalUncapped: 77,
  weeklyRateKg: 0.4,
  currentKg: 72.4,
  goalKg: 68,
  remainingKg: 4.4,
  trendDirection: "losing",
  cappedAtMaxDays: false,
};

export const hierarchyWeekDays = [
  { key: "2026-07-06", label: "Mon", calories: 1400, protein: 95, carbs: 120, fat: 45, targetCalories: 1500, targetProtein: 100, targetCarbs: 150, targetFat: 50, effectiveTargetCalories: 1500, isSnapshot: false },
  { key: "2026-07-07", label: "Tue", calories: 1450, protein: 98, carbs: 125, fat: 46, targetCalories: 1500, targetProtein: 100, targetCarbs: 150, targetFat: 50, effectiveTargetCalories: 1500, isSnapshot: false },
  { key: "2026-07-08", label: "Wed", calories: 1900, protein: 110, carbs: 180, fat: 60, targetCalories: 1500, targetProtein: 100, targetCarbs: 150, targetFat: 50, effectiveTargetCalories: 1500, isSnapshot: false },
  { key: "2026-07-09", label: "Thu", calories: 1480, protein: 96, carbs: 130, fat: 48, targetCalories: 1500, targetProtein: 100, targetCarbs: 150, targetFat: 50, effectiveTargetCalories: 1500, isSnapshot: false },
  { key: "2026-07-10", label: "Fri", calories: 1500, protein: 100, carbs: 140, fat: 50, targetCalories: 1500, targetProtein: 100, targetCarbs: 150, targetFat: 50, effectiveTargetCalories: 1500, isSnapshot: false },
  { key: "2026-07-11", label: "Sat", calories: 0, protein: 0, carbs: 0, fat: 0, targetCalories: 1500, targetProtein: 100, targetCarbs: 150, targetFat: 50, effectiveTargetCalories: 1500, isSnapshot: false },
  { key: "2026-07-12", label: "Sun", calories: 1350, protein: 92, carbs: 115, fat: 44, targetCalories: 1500, targetProtein: 100, targetCarbs: 150, targetFat: 50, effectiveTargetCalories: 1500, isSnapshot: false },
];

export function hierarchyBaseProps(
  overrides: Partial<ProgressHierarchyV1Props> = {},
): ProgressHierarchyV1Props {
  const base: ProgressHierarchyV1Props = {
    mode: "show",
    trajectory: null,
    week: {
      adherencePct: 82,
      days: hierarchyWeekDays,
      todayKey: "2026-07-12",
      macros: [
        { name: "Protein", pct: 92, color: "#7B6FD4" },
        { name: "Carbs", pct: 88, color: "#5B9BD5" },
        { name: "Fat", pct: 104, color: "#E8A838" },
        { name: "Fibre", pct: 71, color: "#6B9080" },
      ],
      streakDays: 4,
      streakFreezesAvailable: 1,
      onOpenStreak: () => undefined,
    },
    energy: {
      avgIntakeKcal: 1840,
      hasEnoughData: true,
      maintenanceKcal: 2073,
      isAdaptive: true,
      adaptiveConfidence: "high",
      qualifierLine: "Based on your last 28 days of logging.",
      periodLabel: "This month",
      latestWeightKg: 72.4,
      goalWeightKg: 68,
    },
    bodyComp: {
      userTier: "free",
      latestBodyFatPct: 24.1,
      latestLeanMassKg: 52.3,
      onOpenPaywall: () => undefined,
    },
    yourWeek: {
      weekKey: "2026-W28",
      headline: "A steady week — protein carried you.",
      usualMealLine: "Overnight oats · 3×",
      bestDay: { label: "Friday", calories: 1500, protein: 96 },
      shareText: "My week on Sloe",
    },
  };
  return { ...base, ...overrides };
}

/** Legacy alias used by trajectory hero story — trajectory slot omitted when null. */
export const hierarchyByDay = buildByDay(7, 1500);
