import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { recipeCard, noop } from "../_hostStoryFixtures";
import { RecipeCardWide } from "./RecipeCardWide";

const meta = {
  title: "Library/RecipeCardWide",
  component: RecipeCardWide,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div style={{ width: 220, padding: 20 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    recipe: recipeCard("r1", "Harissa chickpea stew", {
      calories: 430,
      protein: 19,
      prepTimeMin: 10,
      cookTimeMin: 25,
    }),
    onPress: noop,
  },
} satisfies Meta<typeof RecipeCardWide>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithNutrition: Story = {};

export const NutritionPending: Story = {
  args: {
    recipe: recipeCard("r2", "Draft import", {
      calories: 0,
      protein: 0,
      prepTimeMin: 12,
      cookTimeMin: 18,
    }),
  },
};
