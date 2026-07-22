import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { RecipeCard } from "@/types/recipe";
import { recipeCard, noop } from "../_hostStoryFixtures";
import { LibraryShelvesHeader } from "./LibraryShelvesHeader";

const library: RecipeCard[] = [
  recipeCard("r1", "Tahini grain bowl", { calories: 520, protein: 28, prepTimeMin: 10, cookTimeMin: 15 }),
  recipeCard("r2", "Miso salmon traybake", { calories: 560, protein: 38, prepTimeMin: 10, cookTimeMin: 20 }),
  recipeCard("r3", "Greek yoghurt & berries", { calories: 280, protein: 24, prepTimeMin: 5, cookTimeMin: 0 }),
  recipeCard("r4", "Five-minute egg wrap", { calories: 360, protein: 22, prepTimeMin: 3, cookTimeMin: 2 }),
];

const meta = {
  title: "Library/LibraryShelvesHeader",
  component: LibraryShelvesHeader,
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
    filtered: library,
    category: "all",
    onPressRecipe: noop,
  },
} satisfies Meta<typeof LibraryShelvesHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllCategory: Story = {};

export const HiddenForFilter: Story = {
  args: { category: "dinner" },
  parameters: {
    docs: {
      description: {
        story: "Returns null when category is not `all` — canvas stays empty.",
      },
    },
  },
};

export const SparseMedia: Story = {
  args: {
    sparseMediaEnabled: true,
  },
};
