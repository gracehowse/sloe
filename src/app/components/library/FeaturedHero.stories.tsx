import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { recipeCard, noop } from "../_hostStoryFixtures";
import { FeaturedHero } from "./FeaturedHero";

const meta = {
  title: "Library/FeaturedHero",
  component: FeaturedHero,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div style={{ width: 390, padding: 20 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    recipe: recipeCard("r1", "Miso salmon traybake", {
      calories: 560,
      protein: 38,
      prepTimeMin: 10,
      cookTimeMin: 20,
    }),
    onPress: noop,
  },
} satisfies Meta<typeof FeaturedHero>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithNutrition: Story = {};

export const NutritionPending: Story = {
  args: {
    recipe: recipeCard("r2", "Mystery import", {
      calories: 0,
      protein: 0,
      prepTimeMin: null,
      cookTimeMin: null,
    }),
  },
};
