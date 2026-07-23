import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PlanAnchorBudgetBand } from "./plan-anchor-budget-band";
import type { PlanDayMealLike } from "../../../lib/nutrition/distributeAroundAnchor";

const placeholder = (name: string): PlanDayMealLike => ({
  name,
  recipeTitle: "",
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  isPlaceholder: true,
});

const lockedDinner: PlanDayMealLike = {
  name: "Dinner",
  recipeTitle: "Spaghetti bolognese",
  calories: 780,
  protein: 42,
  carbs: 88,
  fat: 24,
  isLocked: true,
};

const meta = {
  title: "Suppr/PlanAnchorBudgetBand",
  component: PlanAnchorBudgetBand,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Make-anything-fit Mode B band — distribute remaining day budget around a locked anchor meal.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    enabled: true,
    targets: { calories: 2000, protein: 130, carbs: 200, fat: 65 },
  },
} satisfies Meta<typeof PlanAnchorBudgetBand>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DistributedSlots: Story = {
  args: {
    meals: [
      placeholder("Breakfast"),
      placeholder("Lunch"),
      lockedDinner,
      placeholder("Snacks"),
    ],
  },
};

export const Disabled: Story = {
  args: {
    enabled: false,
    meals: [placeholder("Breakfast"), lockedDinner],
  },
};
