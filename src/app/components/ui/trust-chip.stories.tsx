import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TrustChip } from "./trust-chip";

const meta = {
  component: TrustChip,
  tags: ["ai-generated"],
  argTypes: {
    variant: {
      control: "select",
      options: [
        "usda",
        "off-adjusted",
        "estimated",
        "manual",
        "gluten-high-conf",
        "gluten-uncertain",
      ],
    },
  },
} satisfies Meta<typeof TrustChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Usda: Story = { args: { variant: "usda" } };
export const OffAdjusted: Story = { args: { variant: "off-adjusted" } };
export const Estimated: Story = { args: { variant: "estimated" } };
export const Manual: Story = { args: { variant: "manual" } };
export const GlutenHighConf: Story = { args: { variant: "gluten-high-conf" } };
export const GlutenUncertain: Story = { args: { variant: "gluten-uncertain" } };
export const CustomLabel: Story = {
  args: { variant: "manual", label: "Custom provenance" },
};
