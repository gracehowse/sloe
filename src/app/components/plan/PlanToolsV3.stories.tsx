import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PlanToolsV3 } from "./PlanToolsV3";
import { noop, PlanMobileFrame } from "./_planStoryFixtures";

const meta = {
  title: "Plan/PlanToolsV3",
  component: PlanToolsV3,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [(Story) => <PlanMobileFrame><Story /></PlanMobileFrame>],
  args: {
    batchCookSubtitle: "Cook once · scale shopping",
    shoppingItemCount: 23,
    servingCount: 2,
    onOpenBatchCook: noop,
    onOpenShopping: noop,
  },
} satisfies Meta<typeof PlanToolsV3>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithShoppingList: Story = {};

export const EmptyBasket: Story = {
  args: {
    shoppingItemCount: 0,
    servingCount: 1,
  },
};
