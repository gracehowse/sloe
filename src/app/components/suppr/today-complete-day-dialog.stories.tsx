import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TodayCompleteDayDialog } from "./today-complete-day-dialog";

const meta = {
  title: "Suppr/TodayCompleteDayDialog",
  component: TodayCompleteDayDialog,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    onOpenChange: () => undefined,
    onViewProgress: () => undefined,
    profileWeightKg: 72.4,
    todayCalories: 1840,
    targetCalories: 2000,
    todayProteinG: 118,
    proteinTargetG: 130,
    maintenanceTdeeKcal: 2350,
    profileGoal: "lose",
    profileMeasurementSystem: "metric",
  },
} satisfies Meta<typeof TodayCompleteDayDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoseGoal: Story = {};

export const MaintainGoal: Story = {
  args: {
    profileGoal: "maintain",
    todayCalories: 2100,
    targetCalories: 2100,
  },
};
