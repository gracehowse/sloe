import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { BurnDetailLoadingSkeleton } from "./BurnDetailLoadingSkeleton";

const meta = {
  title: "Mobile/Burn/BurnDetailLoadingSkeleton",
  component: BurnDetailLoadingSkeleton,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof BurnDetailLoadingSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Loading: Story = {};
