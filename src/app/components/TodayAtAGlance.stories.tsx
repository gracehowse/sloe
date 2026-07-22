import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TodayAtAGlance } from "./TodayAtAGlance";

const BASE_ARGS = {
  dateLabel: "Wednesday, July 22",
  proteinGoal: 140,
  carbsGoal: 220,
  fatGoal: 65,
  fiberGoal: 30,
  waterEatenLabel: "1.2 L",
  waterGoalLabel: "2.0 L",
  preferActivityAdjusted: false,
  activityBurnKcal: 0,
  baseCalorieGoal: 2000,
  streakDays: 0,
};

const meta = {
  title: "Host/TodayAtAGlance",
  component: TodayAtAGlance,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Tracker summary card — hero ring, macro tiles, fiber/water row, streak + target-hit states.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 520, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    ...BASE_ARGS,
    caloriesEaten: 820,
    calorieGoalNet: 2000,
    proteinEaten: 54,
    carbsEaten: 96,
    fatEaten: 28,
    fiberEaten: 11,
  },
} satisfies Meta<typeof TodayAtAGlance>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FreshDay: Story = {
  name: "Fresh day (no logs)",
  args: {
    caloriesEaten: 0,
    calorieGoalNet: 2000,
    proteinEaten: 0,
    carbsEaten: 0,
    fatEaten: 0,
    fiberEaten: 0,
    streakDays: 5,
  },
};

export const OnTrack: Story = {
  name: "On track",
};

export const TargetsHit: Story = {
  name: "Targets hit",
  args: {
    caloriesEaten: 1980,
    calorieGoalNet: 2000,
    proteinEaten: 132,
    carbsEaten: 210,
    fatEaten: 62,
    fiberEaten: 28,
  },
};

export const ActivityAdjustedGoal: Story = {
  name: "Activity-adjusted goal",
  args: {
    preferActivityAdjusted: true,
    activityBurnKcal: 320,
    baseCalorieGoal: 2000,
    calorieGoalNet: 2320,
    caloriesEaten: 1450,
  },
};
