import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SourceDot } from "./source-dot";

const meta = {
  component: SourceDot,
  tags: ["ai-generated"],
} satisfies Meta<typeof SourceDot>;

export default meta;
type Story = StoryObj<typeof meta>;

/** USDA-verified provenance (default 8px dot, plain path). */
export const Usda: Story = { args: { source: "usda" } };

/** Open Food Facts provenance. */
export const Off: Story = { args: { source: "off" } };

/** FatSecret provenance. */
export const FatSecret: Story = { args: { source: "fatsecret" } };

/** Manual entry provenance. */
export const Manual: Story = { args: { source: "manual" } };

/** AI-estimated provenance — pairs the dot with a Sparkles glyph. */
export const Ai: Story = { args: { source: "ai" } };

/** Largest dot size (10px). */
export const Large: Story = { args: { source: "usda", size: 10 } };

/** Smallest dot size (6px). */
export const Small: Story = { args: { source: "ai", size: 6 } };
