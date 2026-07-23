import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { ConfirmFoodMacroPreview } from "./ConfirmFoodMacroPreview";

const meta = {
  title: "Mobile/FoodSearch/ConfirmFoodMacroPreview",
  component: ConfirmFoodMacroPreview,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ConfirmFoodMacroPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { calories: 420, proteinG: 32, carbsG: 18, fatG: 22 },
};

export const LightSnack: Story = {
  args: { calories: 95, proteinG: 3, carbsG: 12, fatG: 4 },
};
