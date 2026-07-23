import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { RecipeCard } from "@/types/recipe";
import { recipeCard, noop } from "../_hostStoryFixtures";
import { EditorialShelf } from "./EditorialShelf";

const shelfRecipes: RecipeCard[] = [
  recipeCard("r1", "Tahini grain bowl", { calories: 520, protein: 28, prepTimeMin: 10, cookTimeMin: 15 }),
  recipeCard("r2", "Greek yoghurt & berries", { calories: 280, protein: 24, prepTimeMin: 5, cookTimeMin: 0 }),
  recipeCard("r3", "Five-minute egg wrap", { calories: 360, protein: 22, prepTimeMin: 3, cookTimeMin: 2 }),
];

const meta = {
  title: "Library/EditorialShelf",
  component: EditorialShelf,
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
    title: "Fits your day",
    subtitle: "Within today's calorie budget",
    recipes: shelfRecipes,
    onPressRecipe: noop,
  },
} satisfies Meta<typeof EditorialShelf>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const QuickShelf: Story = {
  args: {
    title: "Quick tonight",
    subtitle: "Under 30 minutes total",
    recipes: shelfRecipes.slice(1),
  },
};
