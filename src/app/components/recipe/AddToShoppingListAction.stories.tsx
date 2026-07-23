import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { AddToShoppingListAction } from "./AddToShoppingListAction";
import type { ShoppingItem } from "../../../types/recipe.ts";

const ingredients = [
  { name: "salmon fillet", amount: "2", unit: "" },
  { name: "miso paste", amount: "2", unit: "tbsp" },
];

function AddToShoppingListActionDemo(
  props: Omit<ComponentProps<typeof AddToShoppingListAction>, "setShoppingItems">,
) {
  const [, setShoppingItems] = useState<ShoppingItem[]>([]);
  return <AddToShoppingListAction {...props} setShoppingItems={setShoppingItems} />;
}

const meta = {
  title: "Suppr/Recipe/AddToShoppingListAction",
  component: AddToShoppingListActionDemo,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    recipeId: "recipe-1",
    recipeTitle: "Miso salmon bowl",
    userId: "user-1",
    activeHouseholdId: null,
    ingredients,
    multiplier: 1,
  },
} satisfies Meta<typeof AddToShoppingListActionDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {};

export const ScaledServings: Story = {
  args: { multiplier: 2 },
};
