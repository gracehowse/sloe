import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "./_mobileStoryDecorators";
import { IngredientImageTile } from "./IngredientImageTile";

const meta = {
  title: "Mobile/Components/IngredientImageTile",
  component: IngredientImageTile,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof IngredientImageTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Placeholder: Story = {
  args: { name: "Cherry tomatoes", size: 40 },
};

export const LargeTile: Story = {
  args: { name: "Salmon fillet", size: 56 },
};
