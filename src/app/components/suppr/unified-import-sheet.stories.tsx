import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { UnifiedImportSheet } from "./unified-import-sheet";

/**
 * UnifiedImportSheet — the Sloe v3 import-wedge single front door (web twin of
 * mobile, ENG-1225 #3). With `import_input_v3_polish` default-ON: single-line
 * field, example chips, detect row, choose-a-file.
 */
const meta = {
  title: "Import/UnifiedImportSheet",
  component: UnifiedImportSheet,
  tags: ["autodocs"],
  parameters: { layout: "centered", nextjs: { appDirectory: true } },
  args: { open: true, onOpenChange: () => {} },
} satisfies Meta<typeof UnifiedImportSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OpenEmpty: Story = {
  name: "Open (empty, v3 samples)",
};

export const DetectedSocialReel: Story = {
  name: "Detected social reel",
  args: {
    initialText: "https://www.instagram.com/reel/Cabc123/",
  },
};
