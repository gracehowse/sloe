import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Skeleton } from "./skeleton";

const meta = {
  component: Skeleton,
  tags: ["ai-generated"],
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Line: Story = {
  args: { className: "h-4 w-40" },
};

export const Avatar: Story = {
  args: { className: "size-10 rounded-full" },
};

export const Card: Story = {
  args: { className: "h-24 w-60" },
};
