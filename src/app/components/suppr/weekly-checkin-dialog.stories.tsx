import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WeeklyCheckinDialog } from "./weekly-checkin-dialog";
import type { WeeklyCheckinContent } from "../../../lib/nutrition/weeklyCheckin";

const suggestLower: WeeklyCheckinContent = {
  tdeeDeltaKcal: -120,
  suggestedTargetKcal: 1880,
  floorAppliedKcal: null,
  headline: "Your burn looks lower this week",
  whyLine: "Based on what you logged and your latest weight, your maintenance may have shifted.",
  avgThisWeekLabel: "1,920 kcal",
  weightDeltaLabel: "−0.3 kg",
};

const suggestHigher: WeeklyCheckinContent = {
  tdeeDeltaKcal: 80,
  suggestedTargetKcal: 2080,
  floorAppliedKcal: null,
  headline: "Your burn looks higher this week",
  whyLine: "Your average intake and weight trend suggest a small upward adjustment.",
  avgThisWeekLabel: "2,140 kcal",
  weightDeltaLabel: "+0.2 kg",
};

const meta = {
  title: "Suppr/WeeklyCheckinDialog",
  component: WeeklyCheckinDialog,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    currentTargetKcal: 2000,
    onAccept: () => undefined,
    onDismiss: () => undefined,
  },
} satisfies Meta<typeof WeeklyCheckinDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LowerTarget: Story = {
  args: { content: suggestLower },
};

export const HigherTarget: Story = {
  args: { content: suggestHigher },
};
