import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { LibraryLoadingSkeleton } from "./LibraryLoadingSkeleton";

const meta = {
  title: "Mobile/Library/LibraryLoadingSkeleton",
  component: LibraryLoadingSkeleton,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof LibraryLoadingSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const DarkFrame: Story = {};
