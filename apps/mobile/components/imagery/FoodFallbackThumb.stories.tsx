import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { FoodFallbackThumb } from "./FoodFallbackThumb";

const meta = {
  title: "Mobile/Imagery/FoodFallbackThumb",
  component: FoodFallbackThumb,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof FoodFallbackThumb>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GlyphFallback: Story = {
  args: { name: "Harissa chicken bowl", size: 48 },
};

export const MealSlotBreakfast: Story = {
  args: { name: "Overnight oats", mealSlot: "Breakfast", size: 56 },
};
