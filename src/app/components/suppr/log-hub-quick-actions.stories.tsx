import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LogHubQuickActions } from "./log-hub-quick-actions";

const meta = {
  title: "Suppr/LogHubQuickActions",
  component: LogHubQuickActions,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "LogHub quick-action row — log usual, copy yesterday, duplicate day.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420, background: "var(--bg)" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LogHubQuickActions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllActions: Story = {
  args: {
    quickActions: {
      logUsual: { mealName: "usual breakfast", onTap: () => undefined },
      copyYesterday: { count: 3, onTap: () => undefined },
      duplicateDay: { onTap: () => undefined },
    },
  },
};

export const CopyYesterdayOnly: Story = {
  args: {
    quickActions: {
      copyYesterday: { count: 1, onTap: () => undefined },
    },
  },
};
