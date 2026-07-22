import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DuplicateDayDialog } from "./duplicate-day-dialog";

const meta = {
  title: "Suppr/DuplicateDayDialog",
  component: DuplicateDayDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Duplicate an entire day to a single target or inclusive date range.",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: () => undefined,
    onConfirm: () => undefined,
    sourceDayKey: "2026-07-21",
  },
} satisfies Meta<typeof DuplicateDayDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { sourceMealCount: 5 },
};

export const EmptyDay: Story = {
  name: "Empty day",
  args: { sourceMealCount: 0 },
};
