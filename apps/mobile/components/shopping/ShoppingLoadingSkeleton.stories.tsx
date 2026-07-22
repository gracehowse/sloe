import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { ShoppingLoadingSkeleton } from "./ShoppingLoadingSkeleton";

const meta = {
  title: "Mobile/Shopping/ShoppingLoadingSkeleton",
  component: ShoppingLoadingSkeleton,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ShoppingLoadingSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Loading: Story = {};
