import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ConfidenceDot } from "./confidence-dot";

const meta = {
  title: "Suppr/ConfidenceDot",
  component: ConfidenceDot,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Small coloured dot for nutrition match confidence (high / medium / low).",
      },
    },
  },
} satisfies Meta<typeof ConfidenceDot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const High: Story = {
  args: { level: "high" },
};

export const Medium: Story = {
  args: { level: "medium" },
};

export const Low: Story = {
  args: { level: "low" },
};

export const WithLabel: Story = {
  name: "With label",
  args: { level: "medium", showLabel: true },
};

export const AllLevels: Story = {
  name: "All levels",
  args: { level: "high", showLabel: true },
  render: () => (
    <div className="flex flex-col gap-3">
      <ConfidenceDot level="high" showLabel />
      <ConfidenceDot level="medium" showLabel />
      <ConfidenceDot level="low" showLabel />
    </div>
  ),
};
