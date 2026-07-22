import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FoodFallbackThumb } from "./food-fallback-thumb";

const meta = {
  title: "Suppr/FoodFallbackThumb",
  component: FoodFallbackThumb,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Tiered food-row thumbnail — photo, category sample, or slot/generic glyph.",
      },
    },
  },
} satisfies Meta<typeof FoodFallbackThumb>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GlyphFallback: Story = {
  args: {
    title: "Mixed green salad",
    slot: "Lunch",
    size: 44,
  },
};

export const WithPhoto: Story = {
  args: {
    title: "Grilled salmon",
    slot: "Dinner",
    imageUrl: "/imagery/fallbacks/samples/roast-chicken.png",
    size: 44,
  },
};
