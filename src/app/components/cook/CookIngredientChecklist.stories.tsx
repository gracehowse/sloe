import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  CookIngredientChecklist,
  type CookIngredientChecklistItem,
} from "./CookIngredientChecklist";

const SAMPLE_ITEMS: CookIngredientChecklistItem[] = [
  { name: "Chicken thighs", amountLabel: "600 g" },
  { name: "Smoked paprika", amountLabel: "2 tsp" },
  { name: "Garlic cloves", amountLabel: "4, minced" },
  { name: "Olive oil", amountLabel: "1 tbsp" },
  { name: "Sea salt", amountLabel: "to taste" },
];

const meta = {
  title: "Host/Cook/CookIngredientChecklist",
  component: CookIngredientChecklist,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Tap-to-check ingredient rows for cook mode — persists per recipe in memory for the session.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    recipeId: "storybook-roast-chicken",
    items: SAMPLE_ITEMS,
    surface: "recipe_detail",
  },
} satisfies Meta<typeof CookIngredientChecklist>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const MiseSurface: Story = {
  name: "Mise en place surface",
  args: {
    surface: "mise",
  },
};

export const SingleItem: Story = {
  name: "Single item",
  args: {
    items: [{ name: "Butter", amountLabel: "30 g" }],
  },
};
