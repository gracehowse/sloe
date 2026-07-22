import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PlanDayDetailBandV3 } from "./PlanDayDetailBandV3";
import { PlanMobileFrame } from "./_planStoryFixtures";

const meta = {
  title: "Plan/PlanDayDetailBandV3",
  component: PlanDayDetailBandV3,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [(Story) => <PlanMobileFrame><Story /></PlanMobileFrame>],
  args: {
    dayLabel: "Thursday 18",
    dayTotalKcal: 1650,
    targetKcal: 1830,
    plannedCount: 3,
    cookedCount: 1,
    macros: { protein: 112, carbs: 148, fat: 54 },
  },
} satisfies Meta<typeof PlanDayDetailBandV3>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnTarget: Story = {};

export const OverTarget: Story = {
  args: {
    dayTotalKcal: 2140,
    plannedCount: 4,
    cookedCount: 2,
    macros: { protein: 138, carbs: 182, fat: 71 },
  },
};

export const NothingPlanned: Story = {
  args: {
    dayTotalKcal: 0,
    plannedCount: 0,
    cookedCount: 0,
    macros: null,
  },
};
