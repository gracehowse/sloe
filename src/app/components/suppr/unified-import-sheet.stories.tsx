import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { UnifiedImportSheet } from "./unified-import-sheet";

/**
 * UnifiedImportSheet — the Sloe v3 import-wedge single front door (web twin of
 * the SIM-SEE-validated mobile sheet, ENG-1225 #3). One paste field that accepts
 * any link / plan / export / recipe text, shows a live "Detected: {label}" chip,
 * and routes to the right flow on Import. Rendered open so the modal shell is
 * visible in isolation; the detect chip's states have their own story.
 */
const meta = {
  title: "Import/UnifiedImportSheet",
  component: UnifiedImportSheet,
  tags: ["ai-generated"],
  // `appDirectory: true` mounts @storybook/nextjs-vite's mocked App Router so
  // the component's `useRouter()` (next/navigation) resolves instead of throwing
  // "invariant expected app router to be mounted".
  parameters: { layout: "centered", nextjs: { appDirectory: true } },
  args: { open: true, onOpenChange: () => {} },
} satisfies Meta<typeof UnifiedImportSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  name: "Open (empty)",
};
