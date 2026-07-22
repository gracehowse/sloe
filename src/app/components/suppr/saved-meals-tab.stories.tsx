import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SavedMealsTab } from "./saved-meals-tab";
import type { SavedMeal } from "../../../lib/nutrition/savedMeals";

const SAMPLE_MEALS: SavedMeal[] = [
  {
    id: "meal-1",
    name: "Usual breakfast",
    defaultMealSlot: "Breakfast",
    logCount: 12,
    createdAt: "2026-06-01T08:00:00.000Z",
    lastLoggedAt: "2026-07-21T08:15:00.000Z",
    items: [
      {
        position: 0,
        recipeTitle: "Overnight oats",
        calories: 420,
        protein: 18,
        carbs: 55,
        fat: 12,
        source: "USDA",
      },
      {
        position: 1,
        recipeTitle: "Blueberries",
        calories: 80,
        protein: 1,
        carbs: 18,
        fat: 0,
        source: "USDA",
      },
    ],
  },
  {
    id: "meal-2",
    name: "Desk lunch",
    defaultMealSlot: "Lunch",
    logCount: 5,
    createdAt: "2026-06-10T12:00:00.000Z",
    items: [
      {
        position: 0,
        recipeTitle: "Chicken salad",
        calories: 520,
        protein: 42,
        carbs: 18,
        fat: 28,
      },
    ],
  },
];

const meta = {
  title: "Suppr/SavedMealsTab",
  component: SavedMealsTab,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Usual meals tab body inside QuickAddPanel — presentation-only; parent owns fetch/persistence.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420, background: "var(--bg)", padding: 8 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    activeSlot: "Breakfast",
    pendingIds: new Set<string>(),
    onLog: () => undefined,
    onRename: () => undefined,
    onDelete: () => undefined,
    signedIn: true,
  },
} satisfies Meta<typeof SavedMealsTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithMeals: Story = {
  name: "With saved meals",
  args: {
    meals: SAMPLE_MEALS,
    loading: false,
  },
};

export const SignedOut: Story = {
  name: "Signed out empty",
  args: {
    meals: [],
    loading: false,
    signedIn: false,
  },
};

export const Loading: Story = {
  args: {
    meals: [],
    loading: true,
  },
};
