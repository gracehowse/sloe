import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "./_mobileStoryDecorators";
import { SupprMark, SupprWordmark } from "./SupprMark";

const meta = {
  title: "Mobile/Components/SupprMark",
  component: SupprMark,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SupprMark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mark32: Story = { args: { size: 32 } };
export const Wordmark: Story = { render: () => <SupprWordmark size={28} /> };
