import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CreatorProfileLegacyStats } from "./CreatorProfileLegacyStats";

/**
 * `creator_profile_v3` is registered DEFAULT-ON, and this component returns
 * `null` when the flag resolves true — it only paints on the kill-switch path.
 * Storybook has no PostHog, so we force the flag OFF through the same client
 * hook Playwright uses (`window.__SUPPR_FORCE_FLAGS__`, honoured by
 * `flagForceOverride` in src/lib/analytics/track.ts and inert in production).
 * The key is removed on unmount so the override cannot leak into the next
 * story rendered in the same iframe.
 */
function ForceLegacyProfile({ children }: { children: React.ReactNode }) {
  if (typeof window !== "undefined") {
    const w = window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> };
    w.__SUPPR_FORCE_FLAGS__ = {
      ...(w.__SUPPR_FORCE_FLAGS__ ?? {}),
      creator_profile_v3: false,
    };
  }
  React.useEffect(
    () => () => {
      const w = window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> };
      if (w.__SUPPR_FORCE_FLAGS__) delete w.__SUPPR_FORCE_FLAGS__.creator_profile_v3;
    },
    [],
  );
  return <>{children}</>;
}

const meta = {
  title: "Suppr/Creator/CreatorProfileLegacyStats",
  component: CreatorProfileLegacyStats,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The pre-v3 centred 'N followers · N recipes' line on the web creator profile. It is the kill-switch path for `creator_profile_v3` — with the flag on (the default) it renders nothing and CreatorStatsCard owns the numbers instead. Stories force the flag off so the fallback is snapshotted rather than an empty frame.",
      },
    },
  },
  decorators: [
    (Story) => (
      <ForceLegacyProfile>
        <div style={{ maxWidth: 420 }}>
          <Story />
        </div>
      </ForceLegacyProfile>
    ),
  ],
  args: { followerCount: 1284, recipeCount: 36 },
} satisfies Meta<typeof CreatorProfileLegacyStats>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Both counts singular — exercises the `follower` / `recipe` de-pluralisation. */
export const SingularCounts: Story = {
  args: { followerCount: 1, recipeCount: 1 },
};

/** A brand-new creator: zero on both sides, still plural. */
export const EmptyCreator: Story = {
  args: { followerCount: 0, recipeCount: 0 },
};
