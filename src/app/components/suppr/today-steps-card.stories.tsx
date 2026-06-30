import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TodayStepsCard } from "./today-steps-card";

/**
 * TodayStepsCard — Steps & active-energy card on the Today screen (read-only
 * on web; mirrors mobile `TodayActivityCard`). Pins the states so Chromatic
 * guards them as a durable regression layer:
 *
 *   - Under goal      → steps track fills part-way in plum (`--primary`).
 *   - Goal hit        → steps track full in sage (`--success`).
 *   - No active energy → "—" + the HealthKit-connect hint line.
 *   - No data         → both rows show "—" (Health hasn't synced this day).
 */
const meta = {
  title: "Suppr/TodayStepsCard",
  component: TodayStepsCard,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
  args: {
    stepsForSelectedDay: 6200,
    dailyStepsGoal: 10000,
    activityBurnKcal: 412,
    dayLabel: "Today",
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TodayStepsCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UnderGoal: Story = {
  name: "Under goal (plum track)",
  args: {
    stepsForSelectedDay: 6200,
    dailyStepsGoal: 10000,
    activityBurnKcal: 412,
  },
};

export const GoalHit: Story = {
  name: "Goal hit (sage track)",
  args: {
    stepsForSelectedDay: 11240,
    dailyStepsGoal: 10000,
    activityBurnKcal: 638,
  },
};

export const NoActiveEnergy: Story = {
  name: "No active energy (hint)",
  args: {
    stepsForSelectedDay: 6200,
    dailyStepsGoal: 10000,
    activityBurnKcal: null,
  },
};

export const NoData: Story = {
  name: "No data (never synced)",
  args: {
    stepsForSelectedDay: null,
    dailyStepsGoal: 10000,
    activityBurnKcal: null,
    dayLabel: "Mon 23",
  },
};
