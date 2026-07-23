import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Accent, Colors } from "@/constants/theme";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { TodayWeekCalorieChart } from "./TodayWeekCalorieChart";
import type { TodayWeekDay } from "./TodayWeekTypes";

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

function buildDays(calories: number[]): TodayWeekDay[] {
  return KEYS.map((key, i) => {
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, (m ?? 1) - 1, d ?? 1);
    const kcal = calories[i] ?? 0;
    return {
      key,
      short: date.toLocaleDateString("en-GB", { weekday: "short" }),
      date,
      totals: {
        calories: kcal,
        protein: Math.round((kcal * 0.25) / 4),
        carbs: Math.round((kcal * 0.45) / 4),
        fat: Math.round((kcal * 0.3) / 9),
      },
    };
  });
}

const loggedCalories = [0, 1820, 0, 2100, 1980, 2450, 1240];
const days = buildDays(loggedCalories);
const daysWithFood = days.filter((day) => day.totals.calories > 0).length;
const weekAvgCalories = Math.round(
  days.reduce((sum, day) => sum + day.totals.calories, 0) / Math.max(daysWithFood, 1),
);

const chartStyles = {
  card: {
    backgroundColor: c.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    padding: 16,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: c.text,
  },
};

const meta = {
  title: "Mobile/Today/TodayWeekCalorieChart",
  component: TodayWeekCalorieChart,
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
    weekAvgCalories,
    daysWithFood,
    bestDayLabel: "Thu",
    calorieTarget: 2000,
    dayGoals: days.map(() => 2000),
    onSelectDay: noop,
    styles: chartStyles,
    textSecondaryColor: c.textSecondary,
    textTertiaryColor: c.textTertiary,
    borderColor: c.border,
    textColor: c.text,
    accentPrimary: Accent.primary,
    accentPrimaryLight: Accent.primaryLight,
    preferActivityAdjustedCalories: false,
    activityBonusCaloriesOnly: false,
    maintenanceKcal: 2200,
  },
} satisfies Meta<typeof TodayWeekCalorieChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoggedWeek: Story = {};

export const SparseWeek: Story = {
  args: {
    days: buildDays([0, 1820, 0, 0, 1980, 0, 0]),
    daysWithFood: 2,
    weekAvgCalories: 1900,
    bestDayLabel: "Tue",
  },
};
