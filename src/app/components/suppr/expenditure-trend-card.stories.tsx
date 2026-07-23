import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ExpenditureTrendCard } from "./expenditure-trend-card";

const meta = {
  title: "Suppr/ExpenditureTrendCard",
  component: ExpenditureTrendCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Calm expenditure trend card on Progress — soft-confidence TDEE copy from shared helpers.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ExpenditureTrendCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AdaptiveEstimate: Story = {
  args: {
    adaptiveTdee: 2347,
    adaptiveConfidence: "high",
    adaptiveUpdatedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  },
};

export const StillLearning: Story = {
  args: {
    adaptiveTdee: null,
    adaptiveConfidence: null,
    adaptiveUpdatedAt: null,
  },
};
