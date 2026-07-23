import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "./_mobileStoryDecorators";
import Badge from "./Badge";

const meta = {
  title: "Mobile/Components/Badge",
  component: Badge,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Neutral: Story = { args: { children: "Manual" } };
export const Warn: Story = { args: { variant: "warn", children: "Review" } };
export const Ai: Story = { args: { variant: "ai", children: "AI" } };

