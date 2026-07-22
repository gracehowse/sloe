import type { ProgressHierarchyV1Props } from "./progress-hierarchy-v1";
import type { WeightGoalTimeline } from "../../../../lib/weightProjection";

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
  { key: "2026-07-06", day: "Mon", calories: 1400, effectiveTarget: 1500 },
  { key: "2026-07-07", day: "Tue", calories: 1450, effectiveTarget: 1500 },
  { key: "2026-07-08", day: "Wed", calories: 1900, effectiveTarget: 1500 },
  { key: "2026-07-09", day: "Thu", calories: 1480, effectiveTarget: 1500 },
  { key: "2026-07-10", day: "Fri", calories: 1500, effectiveTarget: 1500 },
  { key: "2026-07-11", day: "Sat", calories: 0, effectiveTarget: 1500 },
  { key: "2026-07-12", day: "Sun", calories: 1350, effectiveTarget: 1500 },
];

/** Full hierarchy composer fixture — mirrors `tests/unit/progressHierarchyWeb.test.tsx`. */
export function hierarchyBaseProps(
  overrides: Partial<ProgressHierarchyV1Props> = {},
): ProgressHierarchyV1Props {
  return {
    weightSurfaceMode: "show",
    hero: {
      isImperial: false,
      latestWeightKg: 72.4,
      goalWeightKg: 68,
      timeline: hierarchyTimeline,
      weighInDayCount: 20,
      chartData: [
        { date: "1 Jul", value: 73.1, ma: 73.0 },
        { date: "8 Jul", value: 72.7, ma: 72.8 },
        { date: "15 Jul", value: 72.4, ma: 72.6, isToday: true },
      ],
      goalWeightChart: 68,
      showRawDots: true,
      byDay: buildByDay(7, 1500),
      targetCalories: 1500,
      maintenanceTdeeKcal: 2200,
      goal: "lose",
      normalizeGoalVocabulary: false,
      weekDeltaKg: -0.4,
      windowLabel: "This month",
      sparse: false,
      onLogWeight: () => undefined,
    },
    week: {
      adherencePct: 82,
      onTargetCount: 5,
      days: hierarchyWeekDays,
      todayKey: "2026-07-12",
      macros: [
        { name: "Protein", pct: 92, color: "var(--macro-protein)" },
        { name: "Carbs", pct: 88, color: "var(--macro-carbs)" },
        { name: "Fat", pct: 104, color: "var(--macro-fat)" },
        { name: "Fibre", pct: 71, color: "var(--macro-fibre)" },
      ],
      streakDays: 4,
      freezesAvailable: 1,
      onOpenStreak: () => undefined,
    },
    energy: {
      avgIntakeKcal: 1840,
      hasEnoughData: true,
      resolved: {
        kcal: 2073,
        source: "adaptive",
        confidence: "high",
        formulaKcal: 2000,
        adaptiveRejectedAsStale: false,
        adaptiveRejectedBelowFormula: false,
        rejectedAdaptiveKcal: null,
        measuredRejectedBelowFormula: false,
        rejectedMeasuredKcal: null,
      },
      latestWeightKg: 72.4,
      goalWeightKg: 68,
      adaptiveProgress: null,
      expenditureCopy: null,
      expenditureSparkline: null,
      sex: "female",
      weightKg: 72.4,
      heightCm: 165,
      age: 30,
      activityLevel: "moderate",
      planPace: "steady",
      userGoal: "lose",
      goalCalories: 1500,
    },
    bodyComp: {
      userTier: "free",
      latestBodyFatPct: 24.1,
      latestLeanMassKg: 52.3,
    },
    yourWeek: {
      weekKey: "2026-W28",
      weekLabel: "6–12 Jul",
      headline: "A steady week — protein carried you.",
      usualMeal: { name: "Overnight oats", count: 3 },
      bestDay: { label: "Friday", calories: 1500, protein: 96 },
      shareText: "My week on Sloe",
    },
    ...overrides,
  };
}
