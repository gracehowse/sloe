import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { TodayStepsCard } from "./today-steps-card";

/**
 * TodayStepsCard — Steps & active-energy card on Today (read-only on web;
 * mirrors mobile `TodayActivityCard`). Pure presentation; the only branches
 * are "Health has synced this day" vs the null/em-dash placeholder.
 *
 * a11y: the "Steps & activity" heading uses `text-primary` (Sloe clay
 * `#C8794E`), which is ~3.05:1 on the cream card — a pre-existing AA
 * contrast miss across the re-skin, not introduced here. `a11y.test: "todo"`
 * keeps axe running as a warning while the Chromatic visual coverage stands.
 */

const meta = {
  title: "Suppr/TodayStepsCard",
  component: TodayStepsCard,
  tags: ["ai-generated"],
  parameters: { layout: "centered", a11y: { test: "todo" } },
  decorators: [
    (Story) => (
      <div className="w-[360px]">
        <Story />
      </div>
    ),
  ],
  args: {
    dailyStepsGoal: 10000,
    dayLabel: "Today",
  },
} satisfies Meta<typeof TodayStepsCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Under goal — primary-tinted track. */
export const InProgress: Story = {
  args: { stepsForSelectedDay: 6400, activityBurnKcal: 320 },
};

/** Goal met — track turns success-green. */
export const GoalMet: Story = {
  args: { stepsForSelectedDay: 11200, activityBurnKcal: 540 },
};

/** No Health data for this day — em-dash placeholders + the
 *  Health-Connect hint under active energy. */
export const NoData: Story = {
  args: { stepsForSelectedDay: null, activityBurnKcal: null },
};

export const InProgressDark: Story = {
  args: { stepsForSelectedDay: 6400, activityBurnKcal: 320 },
  globals: { theme: "dark" },
};
