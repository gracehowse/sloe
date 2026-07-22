import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PlanMealFilterChipsV3 } from "./PlanMealFilterChipsV3";
import { noop, PlanMobileFrame } from "./_planStoryFixtures";

const meta = {
  title: "Plan/PlanMealFilterChipsV3",
  component: PlanMealFilterChipsV3,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [(Story) => <PlanMobileFrame><Story /></PlanMobileFrame>],
  args: {
    selected: "All",
    onSelect: noop,
  },
} satisfies Meta<typeof PlanMealFilterChipsV3>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllMeals: Story = {};

export const DinnerFilter: Story = {
  args: { selected: "Dinner" },
};
