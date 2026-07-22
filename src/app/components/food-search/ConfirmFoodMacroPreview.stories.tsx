import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ConfirmFoodMacroPreview } from "./ConfirmFoodMacroPreview";

const meta = {
  title: "Suppr/FoodSearch/ConfirmFoodMacroPreview",
  component: ConfirmFoodMacroPreview,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    calories: 420,
    proteinG: 32,
    carbsG: 48,
    fatG: 12,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ConfirmFoodMacroPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LightSnack: Story = {
  args: {
    calories: 180,
    proteinG: 12,
    carbsG: 14,
    fatG: 8,
  },
};
