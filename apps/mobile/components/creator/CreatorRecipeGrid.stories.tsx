import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { CreatorRecipeGrid } from "./CreatorRecipeGrid";
import type { CreatorRecipeRow } from "./useCreatorProfile";

const RECIPES: CreatorRecipeRow[] = [
  {
    id: "r1",
    title: "Miso ginger salmon with sesame greens",
    image_url:
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop",
    calories: 520,
    protein: 42,
    carbs: 18,
    prep_time_min: 10,
    cook_time_min: 20,
  },
  {
    id: "r2",
    title: "Harissa chickpea stew",
    image_url: null,
    calories: 410,
    protein: 18,
    carbs: 54,
    prep_time_min: 10,
    cook_time_min: 25,
  },
  {
    id: "r3",
    title: "Charred broccoli with tahini",
    image_url:
      "https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=400&h=300&fit=crop",
    calories: 280,
    protein: 12,
    carbs: 22,
    prep_time_min: 5,
    cook_time_min: 15,
  },
  {
    id: "r4",
    title: "Lemon herb chicken tray bake",
    image_url: null,
    calories: 610,
    protein: 48,
    carbs: 36,
    prep_time_min: 15,
    cook_time_min: 40,
  },
];

const meta = {
  title: "Mobile/Creator/CreatorRecipeGrid",
  component: CreatorRecipeGrid,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Two-up grid of a creator's public recipes. Each tile is a flat hairline card: 4:3 image (or a utensils placeholder on the page ground when there is none), title over two lines max, then one quiet meta line of kcal · total time. Matches the web CreatorRecipeList card composition so a creator's page reads the same on both platforms.",
      },
    },
  },
  args: { recipes: RECIPES },
} satisfies Meta<typeof CreatorRecipeGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A mixed grid — photographed and placeholder tiles side by side. */
export const Default: Story = {};

/** Every tile without imagery: the placeholder must still read as a card, not a hole. */
export const NoImagery: Story = {
  args: { recipes: RECIPES.map((r) => ({ ...r, image_url: null })) },
};

/** Odd count — the last tile stays 48% wide rather than stretching. */
export const SingleRecipe: Story = {
  args: { recipes: [RECIPES[0]] },
};

/** Missing times and calories — the meta line degrades to just the kcal figure. */
export const MissingMetadata: Story = {
  args: {
    recipes: RECIPES.slice(0, 2).map((r) => ({
      ...r,
      calories: null,
      prep_time_min: null,
      cook_time_min: null,
    })),
  },
};
