import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PlanMealCardV3 } from "./PlanMealCardV3";
import { noop, PlanMobileFrame } from "./_planStoryFixtures";

const meta = {
  title: "Plan/PlanMealCardV3",
  component: PlanMealCardV3,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [(Story) => <PlanMobileFrame><Story /></PlanMobileFrame>],
  args: {
    slot: "Lunch",
    name: "Tahini grain bowl",
    kcal: 540,
    isVerified: true,
    onPress: noop,
    onOpenOptions: noop,
  },
} satisfies Meta<typeof PlanMealCardV3>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LockedBatchCooked: Story = {
  args: {
    slot: "Dinner",
    name: "Miso salmon traybake",
    kcal: 610,
    isLocked: true,
    note: "batch",
    isCooked: true,
  },
};
