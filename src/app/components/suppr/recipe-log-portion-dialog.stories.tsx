import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RecipeLogPortionDialog } from "./recipe-log-portion-dialog";

const perServing = {
  calories: 200,
  protein: 10,
  carbs: 20,
  fat: 8,
  fiberG: 2,
};

const meta = {
  title: "Suppr/RecipeLogPortionDialog",
  component: RecipeLogPortionDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Structured recipe log dialog — portion picker or unit stepper with macro preview.",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: () => undefined,
    recipeTitle: "Banana bread",
    perServing,
    baseServings: 12,
    onConfirm: () => undefined,
  },
} satisfies Meta<typeof RecipeLogPortionDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ByWeight: Story = {
  name: "By weight (picker)",
  args: {
    yieldDef: { kind: "weight", totalGrams: 680 },
  },
};

export const ByPiece: Story = {
  name: "By piece (units stepper)",
  args: {
    yieldDef: {
      kind: "units",
      count: 12,
      singular: "slice",
      plural: "slices",
    },
  },
};
