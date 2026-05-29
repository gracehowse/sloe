import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Progress } from "./progress";

const meta = {
  component: Progress,
  tags: ["ai-generated"],
  args: { "aria-label": "Daily calories" },
  argTypes: {
    value: { control: { type: "range", min: 0, max: 100 } },
  },
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { value: 60, className: "w-60" },
};

export const Empty: Story = {
  args: { value: 0, className: "w-60" },
};

export const Complete: Story = {
  args: { value: 100, className: "w-60" },
};
