import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { LoggedMeal } from "@/types/recipe";
import { EditMealDialog } from "./edit-meal-dialog";

const SAMPLE_MEAL: LoggedMeal = {
  id: "meal-1",
  name: "Lunch",
  recipeTitle: "Miso salmon bowl",
  time: "12:30",
  calories: 642,
  protein: 41,
  carbs: 58,
  fat: 22,
  portionMultiplier: 1,
  createdAt: "2026-07-22T12:30:00.000Z",
};

const meta = {
  title: "Suppr/EditMealDialog",
  component: EditMealDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Edit an existing journal entry — slot, title, portion, macros, and optional eaten-at time.",
      },
    },
  },
  args: {
    open: true,
    meal: SAMPLE_MEAL,
    anchorDayKey: "2026-07-22",
    onClose: () => undefined,
    onSave: () => undefined,
  },
} satisfies Meta<typeof EditMealDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const DoublePortion: Story = {
  args: {
    meal: {
      ...SAMPLE_MEAL,
      portionMultiplier: 2,
      calories: 1284,
      protein: 82,
      carbs: 116,
      fat: 44,
    },
  },
};
