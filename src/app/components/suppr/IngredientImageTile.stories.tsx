import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { IngredientImageTile } from "./IngredientImageTile";

const IMAGE_MAP = new Map([
  ["tomato", "https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=64&h=64&fit=crop"],
]);

const meta = {
  title: "Suppr/IngredientImageTile",
  component: IngredientImageTile,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Square ingredient thumbnail on recipe-detail rows — photo when mapped, sage initial placeholder otherwise.",
      },
    },
  },
  args: {
    name: "Cherry tomatoes",
  },
} satisfies Meta<typeof IngredientImageTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Placeholder: Story = {};

export const WithPhoto: Story = {
  args: {
    name: "Tomato",
    imageMap: IMAGE_MAP,
    size: 40,
  },
};

export const LargeTile: Story = {
  args: {
    name: "Basil",
    size: 48,
  },
};
