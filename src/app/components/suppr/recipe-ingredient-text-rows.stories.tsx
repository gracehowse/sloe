import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RecipeIngredientTextRows } from "./recipe-ingredient-text-rows";

const INGREDIENTS = [
  {
    name: "Chicken thighs",
    amount: "450",
    unit: "g",
    calories: 720,
    protein: 84,
    carbs: 0,
    fat: 40,
    isVerified: true,
    source: "USDA",
    confidence: 1,
  },
  {
    name: "Sun-dried tomatoes",
    amount: "100",
    unit: "g",
    calories: 260,
    protein: 6,
    carbs: 44,
    fat: 6,
    isVerified: false,
    source: "AI",
    confidence: 0.6,
  },
  {
    name: "Parmesan",
    amount: "40",
    unit: "g",
    calories: 160,
    protein: 14,
    carbs: 1,
    fat: 11,
    isVerified: false,
    source: "AI",
    confidence: 0.3,
    addedByUser: true,
  },
];

const meta = {
  title: "Suppr/RecipeIngredientTextRows",
  component: RecipeIngredientTextRows,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Prototype `.w-ing` text rows — dotted leader, tier label, SourceDot, verify/fix affordances.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 480, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    ingredients: INGREDIENTS,
    servings: 2,
    baseServings: 2,
    dbIngredientIds: ["ing-0", "ing-1", "ing-2"],
    onVerify: () => undefined,
    onOverride: () => undefined,
  },
} satisfies Meta<typeof RecipeIngredientTextRows>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MixedTiers: Story = {
  name: "Mixed verification tiers",
};

export const ScaledServings: Story = {
  name: "Scaled to 4 servings",
  args: { servings: 4, baseServings: 2 },
};
