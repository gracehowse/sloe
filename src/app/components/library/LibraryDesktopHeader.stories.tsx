import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { LibraryDesktopHeader } from "./LibraryDesktopHeader";

const meta = {
  title: "Library/LibraryDesktopHeader",
  component: LibraryDesktopHeader,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "responsive" },
    docs: {
      description: {
        component:
          "The Cookbook header at `md+`. Under `design_consistency_v1` its 'Cook' overline stops being a private 11/700/0.1em tertiary variant and takes the canonical eyebrow — 11/600/0.12em full ink plus a hairline rule to the margin — the same treatment `ScreenChrome` ships to the mobile-web twin. Before this, one Cookbook screen showed two different eyebrows depending on viewport width.",
      },
    },
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

/** A populated library — canonical eyebrow, rule to the margin, then the title. */
export const Default: Story = {};

export const SingleRecipe: Story = {
  args: {
    recipeCount: 1,
    sortLabel: "A–Z",
  },
};

/** A brand-new library — the header still reads confidently at zero. */
export const EmptyLibrary: Story = {
  args: {
    recipeCount: 0,
    sortLabel: "Recently saved",
  },
};

/** Narrower desktop column — the eyebrow rule shortens with the container
 *  rather than running to a fixed width. */
export const NarrowDesktopColumn: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 720, padding: 24 }}>
        <Story />
      </div>
    ),
  ],
};
