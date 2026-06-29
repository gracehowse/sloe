import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TodayWeeklyInsightCard } from "./today-weekly-insight-card";

/**
 * TodayWeeklyInsightCard — compact desktop right-rail summary on Today. Pins
 * the states so Chromatic guards them as a durable regression layer:
 *
 *   - Loaded week → logged-days line, daily kcal average, 7-bar sparkline.
 *   - Empty week  → planning line only + muted placeholder sparkline (we
 *     refuse to show a faux "0 kcal" average).
 *   - Single day  → singular "1 day logged so far." copy path.
 *   - Solo        → "Planning for you this week" (household size 1).
 *
 * Desktop-only surface (>= `lg:`); mobile Today has no right-rail.
 */
const meta = {
  title: "Suppr/TodayWeeklyInsightCard",
  component: TodayWeeklyInsightCard,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
  args: {
    householdSize: 2,
    loggedDaysInWeek: 5,
    weekAvgKcal: 1920,
    weekDailyKcal: [1850, 2100, 1780, 0, 1990, 1880, 0],
    dailyKcalTarget: 2000,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 300, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TodayWeeklyInsightCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoadedWeek: Story = {
  name: "Loaded week",
  args: {
    householdSize: 2,
    loggedDaysInWeek: 5,
    weekAvgKcal: 1920,
    weekDailyKcal: [1850, 2100, 1780, 0, 1990, 1880, 0],
    dailyKcalTarget: 2000,
  },
};

export const EmptyWeek: Story = {
  name: "Empty week (no logs)",
  args: {
    householdSize: 2,
    loggedDaysInWeek: 0,
    weekAvgKcal: null,
    weekDailyKcal: [0, 0, 0, 0, 0, 0, 0],
    dailyKcalTarget: 2000,
  },
};

export const SingleDay: Story = {
  name: "Single day logged",
  args: {
    householdSize: 1,
    loggedDaysInWeek: 1,
    weekAvgKcal: 1980,
    weekDailyKcal: [1980, 0, 0, 0, 0, 0, 0],
    dailyKcalTarget: 2000,
  },
};
