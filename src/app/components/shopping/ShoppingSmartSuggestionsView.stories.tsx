import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ShoppingSmartSuggestionsView } from "./ShoppingSmartSuggestionsView";
import type { ShoppingSmartSuggestion } from "../../../lib/planning/shoppingSmartSuggestions.ts";

const SAMPLE: ShoppingSmartSuggestion[] = [
  {
    recipeId: "thai-basil",
    title: "Thai Basil Chicken",
    overlapIngredientNames: ["Garlic Clove", "Fish Sauce", "Jasmine Rice", "Lime"],
    overlapCount: 4,
    totalIngredientCount: 8,
    overlapRatio: 0.5,
    macroFit: { score: 0.82, label: "Fits well with what's left today" },
  },
  {
    recipeId: "garlic-noodles",
    title: "Garlic Noodles",
    overlapIngredientNames: ["Garlic Clove", "Fish Sauce"],
    overlapCount: 2,
    totalIngredientCount: 6,
    overlapRatio: 1 / 3,
    macroFit: { score: 0.45, label: "Uses some of today's remaining budget" },
  },
];

const meta = {
  title: "Shopping/SmartSuggestions",
  component: ShoppingSmartSuggestionsView,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "ENG-1634 — shopping-list Smart suggestions: recipes ranked by ingredient overlap, annotated with remaining-macro fit, one-tap Add to plan.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 560, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ShoppingSmartSuggestionsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    suggestions: SAMPLE,
    onAddToPlan: () => {},
  },
};

export const AddedState: Story = {
  name: "With one recipe already added",
  args: {
    suggestions: SAMPLE,
    addedRecipeIds: new Set(["thai-basil"]),
    onAddToPlan: () => {},
  },
};

export const AddingBusy: Story = {
  name: "Add in progress",
  args: {
    suggestions: SAMPLE,
    addingRecipeId: "garlic-noodles",
    onAddToPlan: () => {},
  },
};
