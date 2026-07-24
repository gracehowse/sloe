import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PlanV3WebRail } from "./PlanV3WebRail";

const meta = {
  title: "Plan/PlanV3WebRail",
  component: PlanV3WebRail,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The desktop Plan dashboard's right rail: a plan-derived 'This week' insight (hidden when the week is complete), plus the batch-cook and shopping-list tool cards. One filled CTA in the rail — the insight card's; the tool cards are ghost.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 300 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    openDays: ["Wednesday", "Friday"],
    onGenerate: () => undefined,
    batchCookSubtitle: "Cook once · scale shopping",
    onOpenBatchCook: () => undefined,
    shoppingItemCount: 23,
    servingCount: 2,
    onOpenShopping: () => undefined,
  },
} satisfies Meta<typeof PlanV3WebRail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** One open day — the headline names it rather than counting. */
export const SingleOpenDay: Story = {
  args: { openDays: ["Friday"] },
};

/** Complete week — the insight card drops out entirely rather than inventing
 *  filler advice, leaving the two tool cards. */
export const WeekComplete: Story = {
  args: { openDays: [] },
};

/** Nothing shopped for yet — the shopping card states how the list gets built
 *  instead of showing a zero. */
export const EmptyShoppingList: Story = {
  args: { shoppingItemCount: 0, servingCount: 1 },
};
