import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CountBadge } from "./count-badge";

const meta = {
  component: CountBadge,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Anatomy role **CountBadge** — tab/segment count pill. Shared by SubTabPill + SegmentedTrack so Shopping/Cookbook counts cannot drift. See `docs/design/2026-07-22-ui-anatomy-program.md`.",
      },
    },
  },
} satisfies Meta<typeof CountBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  args: { count: 3, active: false },
};

export const Active: Story = {
  args: { count: 12, active: true },
};

export const Capped: Story = {
  args: { count: 1200, active: false },
};

export const HiddenWhenZero: Story = {
  args: { count: 0 },
};
