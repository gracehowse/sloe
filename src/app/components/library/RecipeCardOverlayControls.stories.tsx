import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { recipeCard, noop } from "../_hostStoryFixtures";
import { RecipeCardOverlayControls } from "./RecipeCardOverlayControls";

const baseRecipe = {
  ...recipeCard("r1", "Miso salmon traybake"),
  savedAt: new Date("2026-06-15"),
  isSaved: true,
  isPublished: true,
};

const meta = {
  title: "Library/RecipeCardOverlayControls",
  component: RecipeCardOverlayControls,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="relative h-44 w-56 rounded-xl bg-muted overflow-hidden">
        <Story />
      </div>
    ),
  ],
  args: {
    recipe: baseRecipe,
    kind: "saved",
    userTier: "free",
    toggleSaveRecipe: () => true,
    collectionsEnabled: true,
  },
} satisfies Meta<typeof RecipeCardOverlayControls>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SavedWithCollections: Story = {};

export const DraftUnsaved: Story = {
  args: {
    recipe: {
      ...baseRecipe,
      isSaved: false,
      isPublished: false,
    },
    kind: "created",
    collectionsEnabled: false,
  },
};
