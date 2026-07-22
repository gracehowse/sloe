import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FoodSearch } from "./FoodSearch";
import { HostProductShell, noop } from "./_hostStoryFixtures";

/**
 * FoodSearch — thin dialog shell around `FoodSearchPanel`. Stories pin the
 * idle open state; typed search hits live provider routes and is out of scope.
 */
const meta = {
  title: "Hosts/FoodSearch",
  component: FoodSearch,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Full-screen food-search dialog — shell + input; results live in FoodSearchPanel stories.",
      },
    },
  },
  decorators: [
    (Story) => (
      <HostProductShell>
        <Story />
      </HostProductShell>
    ),
  ],
  args: {
    open: true,
    onClose: noop,
    onSelect: noop,
  },
} satisfies Meta<typeof FoodSearch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OpenIdle: Story = {
  name: "Open (empty query)",
  args: {
    initialQuery: "",
  },
};

export const OpenWithBudgetContext: Story = {
  name: "Open (budget context)",
  args: {
    initialQuery: "chicken",
    macroTargets: { calories: 2000, protein: 150, carbs: 200, fat: 65, fiber: 30 },
    macroConsumed: { calories: 1420, protein: 98, carbs: 120, fat: 42, fiber: 18 },
    originalDescription: "1 lb chicken breast",
    initialAmount: 1,
    initialUnit: "lb",
  },
};
