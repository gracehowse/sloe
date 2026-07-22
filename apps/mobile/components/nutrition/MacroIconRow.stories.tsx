import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { MacroIconRow } from "./MacroIconRow";

const meta = {
  title: "Mobile/Nutrition/MacroIconRow",
  component: MacroIconRow,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof MacroIconRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullRow: Story = {
  args: {
    kcal: 520,
    protein: 42,
    carbs: 38,
    fat: 18,
    fiber: 6,
    cookMins: 25,
  },
};

export const KcalOnly: Story = {
  args: { kcal: 180, protein: 8, carbs: 22, fat: 6 },
};
