import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StreakFreezeCard } from "./streak-freeze-card";

const LEDGER = {
  earnedAt: [{ earnedAt: "2026-07-01" }, { earnedAt: "2026-07-08" }],
  usedHistory: [{ dateKey: "2026-07-05", earnedAt: "2026-07-01" }],
};

const meta = {
  title: "Suppr/StreakFreezeCard",
  component: StreakFreezeCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Web-only streak freezes card on Progress — collapses the zero-triad when grammar flag is on.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 440, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    freezeBudgetMax: 3,
    emptyStateGrammarOn: true,
  },
} satisfies Meta<typeof StreakFreezeCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithFreezes: Story = {
  name: "With freezes available",
  args: {
    freezesAvailable: 2,
    freezeLedger: LEDGER,
    protectedDateKeys: ["2026-07-05"],
    rawStreakDays: 9,
    streakDays: 8,
    emptyStateGrammarOn: true,
  },
};

export const ZeroCollapse: Story = {
  name: "Zero collapse (grammar on)",
  args: {
    freezesAvailable: 0,
    freezeLedger: { earnedAt: [], usedHistory: [] },
    protectedDateKeys: [],
    rawStreakDays: 2,
    streakDays: 2,
    emptyStateGrammarOn: true,
  },
};

export const LegacyZeroTriad: Story = {
  name: "Legacy 0/0/0 grid (grammar off)",
  args: {
    freezesAvailable: 0,
    freezeLedger: { earnedAt: [], usedHistory: [] },
    protectedDateKeys: [],
    rawStreakDays: 2,
    streakDays: 2,
    emptyStateGrammarOn: false,
  },
};
