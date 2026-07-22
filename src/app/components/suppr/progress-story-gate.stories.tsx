import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgressStoryGate } from "./progress-story-gate";

const meta = {
  title: "Suppr/ProgressStoryGate",
  component: ProgressStoryGate,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Placeholder card shown instead of ProgressHeadline when fewer than 3 days are logged this week.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 380, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProgressStoryGate>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ColdStart: Story = {
  name: "Cold start (0 days)",
  args: { daysLogged: 0, hasHistory: false },
};

export const WarmingUp: Story = {
  name: "Returning user (2 days)",
  args: { daysLogged: 2, hasHistory: true },
};
