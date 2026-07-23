import type { Meta, StoryObj } from "@storybook/react";
import { ShoppingSmartSuggestionsView } from "@/components/shopping/ShoppingSmartSuggestionsView";
import type { ShoppingSmartSuggestion } from "@suppr/shared/planning/shoppingSmartSuggestions";
import { MobileStoryFrame } from "../_fixtures/MobileStoryFrame";

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
  title: "Mobile/Shopping/SmartSuggestions",
  component: ShoppingSmartSuggestionsView,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "ENG-1634 — mobile shopping-list Smart suggestions (overlap primary, remaining-macro fit secondary).",
      },
    },
  },
  decorators: [
    (Story) => (
      <MobileStoryFrame>
        <Story />
      </MobileStoryFrame>
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
