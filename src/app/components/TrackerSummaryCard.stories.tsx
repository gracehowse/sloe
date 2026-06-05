import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { TrackerSummaryCard } from "./TrackerSummaryCard";

/**
 * TrackerSummaryCard — "Today & this week" 2×4 stat grid (calories vs goal,
 * logging streak, week logged, 7-day calorie fit) with an optional fiber /
 * water weekly sub-row. Pure presentation; plain-value props.
 *
 * Key branch: weekly stats are gated on `totalDaysLogged >= 1` — below that
 * the week tiles show em-dashes + the "log a full day" hints
 * (`NotEnoughData`).
 */

const meta = {
  title: "Components/TrackerSummaryCard",
  component: TrackerSummaryCard,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="w-[560px]">
        <Story />
      </div>
    ),
  ],
  args: {
    dateLabel: "Wed, 3 Jun",
  },
} satisfies Meta<typeof TrackerSummaryCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Populated — enough history, all four tiles show real values. */
export const Populated: Story = {
  args: {
    caloriesToday: 1450,
    calorieTarget: 2000,
    streakDays: 6,
    weekLogged: { logged: 5, total: 7 },
    goalFitPercent: 88,
    totalDaysLogged: 24,
  },
};

/** With the fiber / water weekly sub-row. */
export const WithFiberWater: Story = {
  args: {
    caloriesToday: 1450,
    calorieTarget: 2000,
    streakDays: 6,
    weekLogged: { logged: 5, total: 7 },
    goalFitPercent: 88,
    totalDaysLogged: 24,
    weekFiberWater: { fiberDaysMet: 4, waterDaysMet: 6, total: 7 },
  },
};

/** Not enough data — no full day logged yet: week tiles + fit show em-dashes
 *  and the calibrating hints. */
export const NotEnoughData: Story = {
  args: {
    caloriesToday: 320,
    calorieTarget: 2000,
    streakDays: 0,
    weekLogged: { logged: 0, total: 7 },
    goalFitPercent: null,
    totalDaysLogged: 0,
  },
};

export const PopulatedDark: Story = {
  args: {
    caloriesToday: 1450,
    calorieTarget: 2000,
    streakDays: 6,
    weekLogged: { logged: 5, total: 7 },
    goalFitPercent: 88,
    totalDaysLogged: 24,
  },
  globals: { theme: "dark" },
};
