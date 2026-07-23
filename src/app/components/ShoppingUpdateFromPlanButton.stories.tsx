import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ShoppingUpdateFromPlanButton } from "./ShoppingUpdateFromPlanButton";

/**
 * ENG-1527 — web "Update from plan" affordance. Pure presentation +
 * toast wiring; the parent owns the out-of-sync flag and passes `resync`.
 */
const meta = {
  title: "Hosts/ShoppingUpdateFromPlanButton",
  component: ShoppingUpdateFromPlanButton,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Re-syncs the shopping list from the active meal plan without clearing checked rows.",
      },
    },
  },
} satisfies Meta<typeof ShoppingUpdateFromPlanButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  args: {
    resync: async () => ({
      ok: true as const,
      addedCount: 3,
      updatedCount: 1,
      removedCount: 0,
      keptManualCount: 0,
      keptCheckedCount: 2,
      planFingerprint: "story-fp",
      planStartDate: "2026-07-15",
    }),
  },
};

export const SlowResync: Story = {
  name: "Busy (slow resync)",
  args: {
    resync: () =>
      new Promise((resolve) => {
        setTimeout(
          () =>
            resolve({
              ok: true as const,
              addedCount: 0,
              updatedCount: 0,
              removedCount: 0,
              keptManualCount: 0,
              keptCheckedCount: 0,
              planFingerprint: "story-fp",
              planStartDate: null,
            }),
          4000,
        );
      }),
  },
};
