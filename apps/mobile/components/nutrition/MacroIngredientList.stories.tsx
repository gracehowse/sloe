import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { MacroIngredientList } from "./MacroIngredientList";
import { MacroColors } from "@/constants/theme";

const meta = {
  title: "Mobile/Nutrition/MacroIngredientList",
  component: MacroIngredientList,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof MacroIngredientList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ProteinBreakdown: Story = {
  args: {
    breakdown: {
      total: 86,
      lines: [
        { name: "Greek yogurt", value: 28, isFallback: false, lowConfidence: false },
        { name: "Chicken thigh", value: 42, isFallback: false, lowConfidence: false },
        { name: "AI snack", value: 16, isFallback: false, lowConfidence: true },
      ],
    },
    config: { label: "Protein", color: MacroColors.protein, unit: "g" },
  },
};

export const SingleLine: Story = {
  args: {
    breakdown: {
      total: 12,
      lines: [{ name: "Oats", value: 12, isFallback: false, lowConfidence: false }],
    },
    config: { label: "Protein", color: MacroColors.protein, unit: "g" },
  },
};
