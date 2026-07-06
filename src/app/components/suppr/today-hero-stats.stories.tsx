import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { TodayHeroStats } from "./today-hero-stats";

/**
 * TodayHeroStats (desktop hero) — pins the Sloe v3 jewel-dial swap (ENG-1225)
 * inside the real carded desktop hero, so Chromatic guards the dial-in-context
 * (160px dial + Goal/Eaten/Bonus stat row + macro toggle) as a regression
 * layer. The jewel dial is now unconditional (the `sloe_v3_ring` flag was
 * collapsed out in the ENG-1356 flag-collapse sweep — no force needed).
 *
 * The component renders both breakpoints; we force a desktop width so the
 * `hidden md:block` desktop branch is what's captured.
 */
function DesktopFrame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: 640, background: "var(--bg)", padding: 16 }}>{children}</div>
  );
}

const baseArgs = {
  proteinPct: 0.4,
  carbsPct: 0.4,
  fatPct: 0.2,
  expanded: false,
  onToggleExpanded: () => {},
};

const meta = {
  title: "Suppr/TodayHeroStats (desktop)",
  component: TodayHeroStats,
  tags: ["ai-generated"],
  parameters: { layout: "centered", viewport: { defaultViewport: "desktop" } },
  decorators: [
    (Story) => (
      <DesktopFrame>
        <Story />
      </DesktopFrame>
    ),
  ],
} satisfies Meta<typeof TodayHeroStats>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: "Empty (fresh day)",
  args: {
    ...baseArgs,
    consumed: 0,
    target: 2000,
    baseGoal: 2000,
    loggedKcal: 0,
    targetKcal: 2000,
    burnedKcal: 0,
  },
};

export const Under: Story = {
  name: "Under target (sage)",
  args: {
    ...baseArgs,
    consumed: 1200,
    target: 2200,
    baseGoal: 2000,
    loggedKcal: 1200,
    targetKcal: 2200,
    burnedKcal: 420,
    isOnTrack: true,
  },
};

export const Over: Story = {
  name: "Over target (destructive→warm)",
  args: {
    ...baseArgs,
    consumed: 2400,
    target: 2000,
    baseGoal: 2000,
    loggedKcal: 2400,
    targetKcal: 2000,
    burnedKcal: 300,
  },
};
