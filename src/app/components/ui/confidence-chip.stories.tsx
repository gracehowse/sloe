import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ConfidenceChip } from "./confidence-chip";

const meta = {
  component: ConfidenceChip,
  tags: ["ai-generated"],
  argTypes: {
    level: { control: "select", options: ["low", "medium", "high"] },
  },
} satisfies Meta<typeof ConfidenceChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Low: Story = { args: { level: "low" } };
export const Medium: Story = { args: { level: "medium" } };
export const High: Story = { args: { level: "high" } };
export const CustomLabel: Story = {
  args: { level: "medium", label: "Confidence from last weigh-in" },
};
