import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TodayAddMealDialog } from "./today-add-meal-dialog";
import type { RecipeCard } from "../../../types/recipe";

const recipeOptions: RecipeCard[] = [
  {
    id: "recipe-oats",
    creatorName: "You",
    creatorImage: "",
    title: "Overnight oats",
    image: null,
    servings: 1,
    calories: 420,
    protein: 18,
    carbs: 52,
    fat: 12,
    isVerified: false,
    savedCount: 0,
    isSaved: true,
  },
];

const noop = () => undefined;

const baseArgs = {
  open: true,
  onOpenChange: noop,
  selectedDate: new Date("2026-06-21T12:00:00"),
  mealSlot: "Breakfast",
  onMealSlotChange: noop,
  addMode: "recipe" as const,
  onAddModeChange: noop,
  recipeId: "recipe-oats",
  onRecipeIdChange: noop,
  recipeOptions,
  savedRecipesEmpty: false,
  recipePortionMultiplier: 1,
  onRecipePortionMultiplierChange: noop,
  manualName: "",
  onManualNameChange: noop,
  manualCalories: 0,
  onManualCaloriesChange: noop,
  manualProtein: 0,
  onManualProteinChange: noop,
  manualCarbs: 0,
  onManualCarbsChange: noop,
  manualFat: 0,
  onManualFatChange: noop,
  manualFiber: 0,
  onManualFiberChange: noop,
  manualWater: 0,
  onManualWaterChange: noop,
  timeLabel: "8:30 AM",
  onTimeLabelChange: noop,
  onSubmit: noop,
  onOpenSearch: noop,
};

const meta = {
  title: "Suppr/TodayAddMealDialog",
  component: TodayAddMealDialog,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: baseArgs,
} satisfies Meta<typeof TodayAddMealDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RecipeMode: Story = {
  args: { addMode: "recipe", onAddModeChange: noop },
};

export const ManualMode: Story = {
  args: {
    addMode: "manual",
    onAddModeChange: noop,
    manualName: "Banana",
    manualCalories: 105,
    manualProtein: 1,
    manualCarbs: 27,
    manualFat: 0,
  },
};
