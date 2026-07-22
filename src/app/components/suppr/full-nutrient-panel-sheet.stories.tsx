import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FullNutrientPanelSheet } from "./full-nutrient-panel-sheet";

const SAMPLE_MICROS = {
  vitamin_a_mcg: 620,
  vitamin_c_mg: 45,
  vitamin_d_mcg: 8,
  calcium_mg: 420,
  iron_mg: 12,
  potassium_mg: 2800,
  sodium_mg: 2100,
};

const meta = {
  title: "Suppr/FullNutrientPanelSheet",
  component: FullNutrientPanelSheet,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "All 35 nutrients dialog — macros, vitamins, minerals sorted by %DV.",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: () => undefined,
    fiberG: 18,
    totalFatG: 62,
    saturatedFatG: 18,
    totalCarbsG: 210,
    proteinG: 95,
    sugarG: 42,
    cholesterolMg: 180,
  },
} satisfies Meta<typeof FullNutrientPanelSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PopulatedDay: Story = {
  args: {
    microSum: SAMPLE_MICROS,
  },
};

export const SparseMicros: Story = {
  args: {
    microSum: { vitamin_c_mg: 12, sodium_mg: 900 },
    fiberG: 8,
    proteinG: 42,
    totalCarbsG: 95,
    totalFatG: 28,
  },
};
