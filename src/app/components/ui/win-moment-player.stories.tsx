import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { WinMomentPlayer } from "./win-moment-player";

/**
 * ENG-901 — web win-moment visual proof.
 *
 * The web `WinMomentPlayer` previously mounted a 1-frame TRANSPARENT dotLottie
 * placeholder, so the delight peak rendered BLANK on web while mobile shipped a
 * real gold-ring celebration. It now plays a code-driven SVG/CSS celebration
 * (ring sweep + gold bloom + odometer + confetti) in the `--accent-win` token.
 *
 * The host gates the real mount behind once-per-day landmark logic
 * (`redesign_winmoment` collapsed permanently-on, ENG-1651 — no longer a flag
 * check there), so the celebration only appears on an actual landmark hit in
 * the live app. These stories render the presentational primitive directly so
 * the celebration is reviewable for pixels. The animation runs once on mount
 * (~700ms) then settles to a full gold ring + "100%" + label; capture early
 * for the sweep/bloom/confetti frame.
 *
 * Mobile parity: `apps/mobile/components/ui/WinMomentPlayer.tsx` (same contract,
 * Reanimated + react-native-svg).
 */
const meta = {
  title: "Suppr/WinMomentPlayer",
  component: WinMomentPlayer,
  tags: ["ai-generated"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div
        style={{
          background: "var(--background)",
          padding: 24,
          borderRadius: 16,
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WinMomentPlayer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Calorie ring closed at/under target — the shared delight peak. */
export const GoalHit: Story = { args: { celebration: "goal-hit", size: 220 } };

/** A logging-streak milestone. */
export const Streak: Story = { args: { celebration: "streak", size: 220 } };

/** Quiet one-shot confirm flourish on commit. */
export const LogConfirm: Story = {
  args: { celebration: "log-confirm", size: 180 },
};
