import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PlanEmptySlotV3 } from "./PlanEmptySlotV3";
import { noop, PlanMobileFrame } from "./_planStoryFixtures";

const meta = {
  title: "Plan/PlanEmptySlotV3",
  component: PlanEmptySlotV3,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [(Story) => <PlanMobileFrame><Story /></PlanMobileFrame>],
  args: {
    slot: "Dinner",
    onPress: noop,
  },
} satisfies Meta<typeof PlanEmptySlotV3>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Dinner: Story = {};

export const Breakfast: Story = {
  args: { slot: "Breakfast" },
};
