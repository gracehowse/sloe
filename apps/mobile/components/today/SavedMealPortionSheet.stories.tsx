import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { SavedMeal } from "@suppr/nutrition-core/savedMeals";
const meal: SavedMeal = {
  id: "sm1", name: "Chicken rice bowl", items: [{ id: "i1", position: 0, recipeTitle: "Chicken", calories: 300, protein: 30, carbs: 0, fat: 8 }],
  createdAt: "2026-06-01T12:00:00Z", logCount: 3,
};

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { SavedMealPortionSheet } from "./SavedMealPortionSheet";

const meta = {
  title: "Mobile/Today/SavedMealPortionSheet",
  component: SavedMealPortionSheet,
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
    meal,
    slot: "Lunch",
    slots: ["Breakfast", "Lunch", "Dinner", "Snacks"],
    onChangeSlot: noop,
    onConfirm: noop,
    onClose: noop,
  },
} satisfies Meta<typeof SavedMealPortionSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};
export const Closed: Story = { args: { meal: null } };
