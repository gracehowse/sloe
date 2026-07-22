import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { LibraryLoadingSkeleton } from "./LibraryLoadingSkeleton";

const meta = {
  title: "Library/LibraryLoadingSkeleton",
  component: LibraryLoadingSkeleton,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof LibraryLoadingSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NarrowViewport: Story = {
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
