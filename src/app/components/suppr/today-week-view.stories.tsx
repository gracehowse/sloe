import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TodayWeekView, type TodayWeekDay } from "./today-week-view";

const KEYS = [
  "2026-06-15",
  "2026-06-16",
  "2026-06-17",
  "2026-06-18",
  "2026-06-19",
  "2026-06-20",
  "2026-06-21",
];
const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildDays(): TodayWeekDay[] {
  return KEYS.map((key, i) => {
    const [y, m, d] = key.split("-").map(Number);
    const calories = [0, 1820, 0, 2100, 1980, 2450, 1240][i];
    return {
      key,
      short: SHORT[new Date(y, m - 1, d).getDay()] ?? "",
      date: new Date(y, m - 1, d),
      totals: {
        calories,
        protein: Math.round(calories * 0.25) / 4,
        carbs: Math.round(calories * 0.45) / 4,
        fat: Math.round(calories * 0.3) / 9,
      },
      waterMl: calories > 0 ? 1500 : 0,
      steps: calories > 0 ? 7200 + i * 200 : null,
    };
  });
}

const days = buildDays();
const weekTotals = days.reduce(
  (acc, day) => ({
    calories: acc.calories + day.totals.calories,
    protein: acc.protein + day.totals.protein,
    carbs: acc.carbs + day.totals.carbs,
    fat: acc.fat + day.totals.fat,
  }),
  { calories: 0, protein: 0, carbs: 0, fat: 0 },
);
const loggedDaysInWeek = days.filter((d) => d.totals.calories > 0).length;

const meta = {
  title: "Suppr/TodayWeekView",
  component: TodayWeekView,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    days,
    weekTotals,
    weekAvg: {
      calories: Math.round(weekTotals.calories / loggedDaysInWeek),
      protein: Math.round(weekTotals.protein / loggedDaysInWeek),
      carbs: Math.round(weekTotals.carbs / loggedDaysInWeek),
      fat: Math.round(weekTotals.fat / loggedDaysInWeek),
    },
    loggedDaysInWeek,
    weekEffectiveCalorieBudget: 14000,
    weekBurnTotal: 16500,
    calorieTarget: 2000,
    proteinTarget: 130,
    carbsTarget: 195,
    fatTarget: 62,
    waterMlTarget: 2000,
    dailyStepsGoal: 10000,
    preferActivityAdjustedCalories: true,
    maintenanceForWeek: 2200,
    dayGoals: days.map(() => 2000),
    onSelectDayKey: () => undefined,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 720, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TodayWeekView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoggedWeek: Story = {};

export const SparseWeek: Story = {
  args: {
    loggedDaysInWeek: 2,
    weekAvg: { calories: 1965, protein: 90, carbs: 180, fat: 55 },
    weekBurnTotal: 4800,
    days: days.map((day, i) =>
      i === 1 || i === 4
        ? day
        : {
            ...day,
            totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
            waterMl: 0,
            steps: null,
          },
    ),
  },
};
