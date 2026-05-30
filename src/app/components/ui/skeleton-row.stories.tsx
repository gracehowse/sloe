import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SkeletonRow, SkeletonCard } from "./skeleton-row";

const meta = {
  component: SkeletonRow,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof SkeletonRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default row — thumb + two text lines. */
export const Row: Story = {};

/** Single secondary line. */
export const RowSingleLine: Story = { args: { lines: 1 } };

/** No leading thumb silhouette. */
export const RowNoThumb: Story = { args: { thumb: false } };

/** Default card — hero area + two body lines. */
export const Card: Story = { render: () => <SkeletonCard /> };

/** Card without the hero image area. */
export const CardNoHero: Story = { render: () => <SkeletonCard hero={false} /> };

/** Card with a single body line (no extra lines rendered). */
export const CardSingleLine: Story = { render: () => <SkeletonCard lines={1} /> };

/** Card with three body lines (widths step up per line). */
export const CardThreeLines: Story = { render: () => <SkeletonCard lines={3} /> };
