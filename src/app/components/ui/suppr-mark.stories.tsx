import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  SupprMark,
  SupprWordmark,
  SupprPlateMark,
  SupprPlateWordmark,
} from "./suppr-mark";

const meta = {
  component: SupprMark,
  tags: ["ai-generated"],
} satisfies Meta<typeof SupprMark>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Brand mark at the default 32px. */
export const Mark: Story = {};

/** Brand mark at an explicit size. */
export const MarkSized: Story = { args: { size: 48 } };

/** Mark + "Suppr" wordmark lockup (default 28px). */
export const Wordmark: Story = { render: () => <SupprWordmark /> };

/** Wordmark lockup at an explicit size. */
export const WordmarkSized: Story = { render: () => <SupprWordmark size={40} /> };

/** Plate variant of the mark (default 32px). */
export const PlateMark: Story = { render: () => <SupprPlateMark /> };

/** Plate mark at an explicit size. */
export const PlateMarkSized: Story = { render: () => <SupprPlateMark size={48} /> };

/** Plate mark + wordmark lockup (default 28px). */
export const PlateWordmark: Story = { render: () => <SupprPlateWordmark /> };

/** Plate wordmark lockup at an explicit size. */
export const PlateWordmarkSized: Story = {
  render: () => <SupprPlateWordmark size={40} />,
};
