import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RecipeIngredientRows } from "./RecipeIngredientRows";
import { mobileStoryFrame } from "../_mobileStoryDecorators";

const INGREDIENTS = [
  { name: "Spaghetti", amount: 400, unit: "g", calories: 580, protein: 20, carbs: 112, fat: 2 },
  { name: "Pancetta", amount: 150, unit: "g", calories: 420, protein: 22, carbs: 0, fat: 38 },
  { name: "Eggs", amount: 4, unit: "", calories: 280, protein: 24, carbs: 2, fat: 20 },
  { name: "Pecorino romano", amount: 60, unit: "g", calories: 230, protein: 16, carbs: 1, fat: 18 },
  { name: "Black pepper", amount: 1, unit: "tsp", calories: 6, protein: 0, carbs: 1, fat: 0 },
  { name: "Sea salt", amount: 1, unit: "tsp", calories: 0, protein: 0, carbs: 0, fat: 0 },
];

const meta = {
  title: "Mobile/Recipe/RecipeIngredientRows",
  component: RecipeIngredientRows,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Recipe-detail ingredient text rows (ENG-1611 prototype `.rd-ing`). The section head carries the servings stepper when the host wires `onDecrease` + `onIncrease`, so scaling sits with the quantities it changes instead of in a second control elsewhere on the screen. Without those handlers the head degrades to the static 'For N servings' line. `canDecrease` / `canIncrease` drive the disabled treatment at the range ends rather than letting a press silently no-op.",
      },
    },
  },
  args: {
    ingredients: INGREDIENTS,
    forServings: 2,
    viewMultiplier: 1,
    onIngredientPress: () => undefined,
    onViewAll: () => undefined,
    expanded: true,
  },
} satisfies Meta<typeof RecipeIngredientRows>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Static head — no stepper handlers, so the head reads "For 2 servings". */
export const Default: Story = {};

/** Collapsed to the preview count, with the "view all" affordance. */
export const Collapsed: Story = { args: { expanded: false } };

/** Stepper wired: the section head owns servings scaling. */
export const WithServingsStepper: Story = {
  args: {
    canDecrease: true,
    canIncrease: true,
    onDecrease: () => undefined,
    onIncrease: () => undefined,
  },
};

/** Bottom of the range — minus is disabled rather than silently no-op. */
export const StepperAtMinimum: Story = {
  args: {
    forServings: 1,
    viewMultiplier: 0.5,
    canDecrease: false,
    canIncrease: true,
    onDecrease: () => undefined,
    onIncrease: () => undefined,
  },
};

/** Top of the range — plus is disabled, and quantities show the scaled values. */
export const StepperAtMaximum: Story = {
  args: {
    forServings: 12,
    viewMultiplier: 6,
    canDecrease: true,
    canIncrease: false,
    onDecrease: () => undefined,
    onIncrease: () => undefined,
  },
};
