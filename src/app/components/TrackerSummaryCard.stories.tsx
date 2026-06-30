import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TrackerSummaryCard } from "./TrackerSummaryCard";

/**
 * TrackerSummaryCard — "Today & this week" snapshot card (tracker surface).
 * Read-only; the host computes every stat. Pins the states so Chromatic + the
 * a11y gate guard them as a durable regression layer:
 *
 *   - No data    → weekly tiles collapse to "—" until ≥1 full day is logged
 *                  (`totalDaysLogged = 0`); only the live calorie tile fills.
 *   - Under goal → calories below target → "% of daily goal" sub-line + the
 *                  weekly tiles populate (streak, week-logged, 7-day fit).
 *   - Goal hit   → calories at/over target → 100% of goal, with the optional
 *                  fiber / water weekly-goal split rendered.
 */
const meta = {
  title: "Suppr/TrackerSummaryCard",
  component: TrackerSummaryCard,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
  args: {
    dateLabel: "Mon 22 Jun",
    caloriesToday: 1420,
    calorieTarget: 2000,
    streakDays: 6,
    weekLogged: { logged: 5, total: 7 },
    goalFitPercent: 88,
    totalDaysLogged: 24,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TrackerSummaryCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoData: Story = {
  name: "No data (no full day yet)",
  args: {
    caloriesToday: 0,
    calorieTarget: 2000,
    streakDays: 0,
    weekLogged: { logged: 0, total: 7 },
    goalFitPercent: null,
    totalDaysLogged: 0,
  },
};

export const UnderGoal: Story = {
  name: "Under goal",
  args: {
    caloriesToday: 1420,
    calorieTarget: 2000,
    streakDays: 6,
    weekLogged: { logged: 5, total: 7 },
    goalFitPercent: 88,
    totalDaysLogged: 24,
  },
};

export const GoalHit: Story = {
  name: "Goal hit (with fiber/water split)",
  args: {
    caloriesToday: 2000,
    calorieTarget: 2000,
    streakDays: 14,
    weekLogged: { logged: 7, total: 7 },
    goalFitPercent: 96,
    totalDaysLogged: 41,
    weekFiberWater: { fiberDaysMet: 5, waterDaysMet: 6, total: 7 },
  },
};
