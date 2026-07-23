import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SearchResultConfidenceChip } from "./search-result-confidence-chip";

const meta = {
  component: SearchResultConfidenceChip,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Search-result nutrition trust chip — Verified (structured) vs Estimated. Distinct from `ConfidenceChip` (TDEE low/medium/high). Callers must pass an honest tier.",
      },
    },
  },
} satisfies Meta<typeof SearchResultConfidenceChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Verified: Story = {
  args: {
    tier: "verified",
  },
};

export const Estimated: Story = {
  args: {
    tier: "estimated",
  },
};
