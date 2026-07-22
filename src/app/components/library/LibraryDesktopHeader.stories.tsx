import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { LibraryDesktopHeader } from "./LibraryDesktopHeader";

const meta = {
  title: "Library/LibraryDesktopHeader",
  component: LibraryDesktopHeader,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "responsive" },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 960, padding: 32 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    recipeCount: 42,
    sortLabel: "Recently saved",
  },
} satisfies Meta<typeof LibraryDesktopHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SingleRecipe: Story = {
  args: {
    recipeCount: 1,
    sortLabel: "A–Z",
  },
};
