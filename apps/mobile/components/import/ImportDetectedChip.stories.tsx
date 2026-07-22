import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { ImportDetectedChip } from "./ImportDetectedChip";

const meta = {
  title: "Mobile/Import/ImportDetectedChip",
  component: ImportDetectedChip,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ImportDetectedChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RecipeUrl: Story = {
  args: { input: "https://example.com/recipes/lemon-chicken" },
};

export const PlanText: Story = {
  args: { input: "Monday breakfast: oats\nTuesday lunch: soup" },
};
