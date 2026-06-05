import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { TodayWeeklyInsightCard } from "./today-weekly-insight-card";

/**
 * TodayWeeklyInsightCard — compact desktop right-rail summary on Today:
 * household planning line, days-logged copy, weekly avg kcal, and a 7-bar
 * sparkline (bars scaled to target, empty days at a visible ~4% baseline).
 * Pure presentation, all derived from plain props.
 *
 * Stories pin the populated week, the empty/no-logs week (muted placeholder
 * sparkline, no faux "0 kcal" result), and the single-day-logged copy edge.
 */

const meta = {
  title: "Suppr/TodayWeeklyInsightCard",
  component: TodayWeeklyInsightCard,
  tags: ["ai-generated"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="w-[300px]">
        <Story />
      </div>
    ),
  ],
  args: {
    dailyKcalTarget: 2000,
  },
} satisfies Meta<typeof TodayWeeklyInsightCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Populated week — 5 days logged, avg shown, full sparkline. */
export const Populated: Story = {
  args: {
    householdSize: 2,
    loggedDaysInWeek: 5,
    weekAvgKcal: 1880,
    weekDailyKcal: [1950, 2100, 1820, 0, 1760, 1980, 0],
  },
};

/** Empty week — no logs yet: "Log a meal to start the week", null avg, and
 *  the muted placeholder sparkline (all bars at the ~4% baseline). */
export const EmptyWeek: Story = {
  args: {
    householdSize: 1,
    loggedDaysInWeek: 0,
    weekAvgKcal: null,
    weekDailyKcal: [0, 0, 0, 0, 0, 0, 0],
  },
};

/** Single day logged — the "1 day logged so far." copy edge. */
export const OneDayLogged: Story = {
  args: {
    householdSize: 1,
    loggedDaysInWeek: 1,
    weekAvgKcal: 1950,
    weekDailyKcal: [1950, 0, 0, 0, 0, 0, 0],
  },
};

/** No household line (householdSize 0 hides the planning row). */
export const NoHouseholdLine: Story = {
  args: {
    householdSize: 0,
    loggedDaysInWeek: 3,
    weekAvgKcal: 1900,
    weekDailyKcal: [1950, 2100, 1650, 0, 0, 0, 0],
  },
};

export const PopulatedDark: Story = {
  args: {
    householdSize: 2,
    loggedDaysInWeek: 5,
    weekAvgKcal: 1880,
    weekDailyKcal: [1950, 2100, 1820, 0, 1760, 1980, 0],
  },
  globals: { theme: "dark" },
};
