import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TodayLoadingSkeleton } from "./today-loading-skeleton";

const meta = {
  title: "Suppr/TodayLoadingSkeleton",
  component: TodayLoadingSkeleton,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof TodayLoadingSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MobileWidth: Story = {
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 390, margin: "0 auto", background: "var(--bg)" }}>
        <Story />
      </div>
    ),
  ],
};

export const DesktopWidth: Story = {
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720, margin: "0 auto", background: "var(--bg)" }}>
        <Story />
      </div>
    ),
  ],
};
