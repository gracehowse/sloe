import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RecipeHeroCostEstimate } from "./RecipeHeroCostEstimate";

const ingredients = [
  { name: "salmon fillet", amount: "2", unit: "" },
  { name: "miso paste", amount: "2", unit: "tbsp" },
  { name: "rice", amount: "1", unit: "cup" },
  { name: "spring onion", amount: "2", unit: "" },
];

const meta = {
  title: "Suppr/Recipe/RecipeHeroCostEstimate",
  component: RecipeHeroCostEstimate,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    ingredients,
    servings: 4,
    baseServings: 4,
    isPro: true,
    onUpgrade: () => {},
  },
} satisfies Meta<typeof RecipeHeroCostEstimate>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ProEstimate: Story = {};

export const LockedForFree: Story = {
  args: { isPro: false },
};
