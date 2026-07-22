import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PlanMealSectionV3 } from "./PlanMealSectionV3";
import { noop, PlanMobileFrame, sampleWeek, weekDates } from "./_planStoryFixtures";

const meta = {
  title: "Plan/PlanMealSectionV3",
  component: PlanMealSectionV3,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [(Story) => <PlanMobileFrame><Story /></PlanMobileFrame>],
  args: {
    plan: sampleWeek,
    selectedDayIndex: 3,
    weekDates,
    filter: "All",
    onOpenMeal: noop,
    onAddToSlot: noop,
    onOpenMealOptions: noop,
  },
} satisfies Meta<typeof PlanMealSectionV3>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DayDetailAll: Story = {};

export const DinnerAcrossWeek: Story = {
  args: { filter: "Dinner" },
};
