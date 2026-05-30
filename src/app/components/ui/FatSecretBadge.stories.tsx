import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FatSecretBadge } from "./FatSecretBadge";

const meta = {
  component: FatSecretBadge,
  tags: ["ai-generated"],
} satisfies Meta<typeof FatSecretBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Official 90×15 attribution badge image (default). */
export const Default: Story = {};

/** Plain-text fallback for contexts where the badge PNG lacks contrast. */
export const Text: Story = { args: { variant: "text" } };

/** Text variant with a caller-supplied className. */
export const CustomClass: Story = {
  args: { variant: "text", className: "text-foreground" },
};

/** `show={false}` renders nothing — callers pass `show={hasFatSecretContent}`. */
export const Hidden: Story = { args: { show: false } };
