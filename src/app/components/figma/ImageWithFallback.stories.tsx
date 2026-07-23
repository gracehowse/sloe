import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ImageWithFallback } from "./ImageWithFallback";

const meta = {
  title: "Suppr/Figma/ImageWithFallback",
  component: ImageWithFallback,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    src: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=240&h=240&fit=crop",
    alt: "Salad bowl",
    className: "w-40 h-40 rounded-xl object-cover",
  },
} satisfies Meta<typeof ImageWithFallback>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoadedImage: Story = {};

export const BrokenSourceFallback: Story = {
  args: {
    src: "https://example.invalid/missing.jpg",
    alt: "Missing image",
  },
};
