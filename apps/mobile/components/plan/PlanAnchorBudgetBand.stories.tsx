import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { PlanDayMealLike } from "@suppr/shared/planning/distributeAroundAnchor";
const placeholder = (name: string): PlanDayMealLike => ({ name, recipeTitle: "", calories: 0, protein: 0, carbs: 0, fat: 0, isPlaceholder: true });
const lockedDinner: PlanDayMealLike = { name: "Dinner", recipeTitle: "Spaghetti bolognese", calories: 780, protein: 42, carbs: 88, fat: 24, isLocked: true };

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { PlanAnchorBudgetBand } from "./PlanAnchorBudgetBand";

const meta = {
  title: "Mobile/Plan/PlanAnchorBudgetBand",
  component: PlanAnchorBudgetBand,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider>
        <div style={{ width: 360, padding: 16, background: "#F7F6FA" }}>
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
  parameters: { layout: "fullscreen" },
  args: {
    enabled: true,
    targets: { calories: 2000, protein: 130, carbs: 200, fat: 65 },
    meals: [placeholder("Breakfast"), placeholder("Lunch"), lockedDinner, placeholder("Snacks")],
  },
} satisfies Meta<typeof PlanAnchorBudgetBand>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DistributedSlots: Story = {};
export const Disabled: Story = { args: { enabled: false } };
