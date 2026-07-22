import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Colors } from "@/constants/theme";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { TodayWeekView, type TodayWeekDay } from "./TodayWeekView";

const c = Colors.light;
const noop = () => undefined;

const KEYS = [
  "2026-06-15",
  "2026-06-16",
  "2026-06-17",
  "2026-06-18",
  "2026-06-19",
  "2026-06-20",
  "2026-06-21",
];

function buildDays(): TodayWeekDay[] {
  return KEYS.map((key, i) => {
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, (m ?? 1) - 1, d ?? 1);
    const calories = [0, 1820, 0, 2100, 1980, 2450, 1240][i] ?? 0;
    return {
      key,
      short: date.toLocaleDateString("en-GB", { weekday: "short" }),
      date,
      totals: {
        calories,
        protein: Math.round((calories * 0.25) / 4),
        carbs: Math.round((calories * 0.45) / 4),
        fat: Math.round((calories * 0.3) / 9),
      },
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
const daysWithFood = days.filter((day) => day.totals.calories > 0).length;

const meta = {
  title: "Mobile/Today/TodayWeekView",
  component: TodayWeekView,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider>
        <div style={{ width: 360, padding: 16, background: "#F7F6FA" }}>
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
  parameters: { layout: "fullscreen" },
  args: {
    days,
    weekTotals,
    weekAvg: {
      calories: Math.round(weekTotals.calories / Math.max(daysWithFood, 1)),
      protein: Math.round(weekTotals.protein / Math.max(daysWithFood, 1)),
      carbs: Math.round(weekTotals.carbs / Math.max(daysWithFood, 1)),
      fat: Math.round(weekTotals.fat / Math.max(daysWithFood, 1)),
    },
    daysWithFood,
    weekEffectiveCalorieBudget: 14000,
    weekBurnTotal: 16500,
    calorieTarget: 2000,
    proteinTarget: 130,
    carbsTarget: 195,
    fatTarget: 62,
    preferActivityAdjustedCalories: true,
    activityBonusCaloriesOnly: false,
    maintenanceKcal: 2200,
    dayGoals: days.map(() => 2000),
    onSelectDay: noop,
    styles: {},
    textColor: c.text,
    textSecondaryColor: c.textSecondary,
    textTertiaryColor: c.textTertiary,
    borderColor: c.border,
  },
} satisfies Meta<typeof TodayWeekView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoggedWeek: Story = {};

export const SparseWeek: Story = {
  args: {
    daysWithFood: 2,
    weekAvg: { calories: 1965, protein: 90, carbs: 180, fat: 55 },
    days: days.map((day, i) =>
      i === 1 || i === 4
        ? day
        : { ...day, totals: { calories: 0, protein: 0, carbs: 0, fat: 0 } },
    ),
  },
};
