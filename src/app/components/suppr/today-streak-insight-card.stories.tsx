import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TodayStreakInsightCard } from "./today-streak-insight-card";

/**
 * TodayStreakInsightCard — streak + freeze insight card on Today (read-only;
 * all freeze-ledger state lives in the host). Pins the states so Chromatic
 * guards them as a durable regression layer:
 *
 *   - Streak only → "N-day logging streak" + supportive subline.
 *   - With freezes → adds the "N freezes available" freeze badge.
 *   - Freeze earned → adds the dismissible "You earned a freeze" status row.
 *   - Zero streak → renders nothing (no streak to celebrate).
 */
const meta = {
  title: "Suppr/TodayStreakInsightCard",
  component: TodayStreakInsightCard,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
  args: {
    streakDays: 12,
    freezesAvailableToday: 0,
    hasUnseenFreezeEarned: false,
    onDismissFreezeEarned: () => {},
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TodayStreakInsightCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StreakOnly: Story = {
  name: "Streak only",
  args: { streakDays: 12, freezesAvailableToday: 0, hasUnseenFreezeEarned: false },
};

export const WithFreezes: Story = {
  name: "With freezes available",
  args: { streakDays: 12, freezesAvailableToday: 2, hasUnseenFreezeEarned: false },
};

export const FreezeEarned: Story = {
  name: "Freeze just earned",
  args: { streakDays: 12, freezesAvailableToday: 1, hasUnseenFreezeEarned: true },
};

export const ZeroStreak: Story = {
  name: "Zero streak (renders nothing)",
  args: { streakDays: 0, freezesAvailableToday: 0, hasUnseenFreezeEarned: false },
};
