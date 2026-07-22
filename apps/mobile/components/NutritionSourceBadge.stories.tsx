import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "./_mobileStoryDecorators";
import NutritionSourceBadge from "./NutritionSourceBadge";

const meta = {
  title: "Mobile/Components/NutritionSourceBadge",
  component: NutritionSourceBadge,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof NutritionSourceBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const VerifiedCompact: Story = {
  args: { source: "fatsecret:123", compact: true },
};

export const EstimatedExpanded: Story = {
  args: { source: "ai:voice", compact: false },
};
