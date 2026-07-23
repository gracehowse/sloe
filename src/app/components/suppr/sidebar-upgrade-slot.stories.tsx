import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { SidebarUpgradeSlot } from "./sidebar-upgrade-slot";

const PREMIUM_SWEEP_FLAG = ["premium-sweep", "v2", "p0", "t12"].join("-");

const mockPostHog = {
  ...posthog,
  __loaded: true,
  onFeatureFlags: (callback: () => void) => {
    callback();
    return () => undefined;
  },
  isFeatureEnabled: (key: string) => key === PREMIUM_SWEEP_FLAG,
  getFeatureFlag: (key: string) => (key === PREMIUM_SWEEP_FLAG ? true : false),
} as unknown as typeof posthog;

const meta = {
  title: "Suppr/SidebarUpgradeSlot",
  component: SidebarUpgradeSlot,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Free-tier upgrade promo at the bottom of the desktop sidebar — gated on the premium-sweep v2 P0 T12 flag.",
      },
    },
  },
  decorators: [
    (Story) => (
      <PostHogProvider client={mockPostHog}>
        <div style={{ width: 260, background: "var(--bg)", padding: 8 }}>
          <Story />
        </div>
      </PostHogProvider>
    ),
  ],
  args: {
    onNavigate: () => undefined,
  },
} satisfies Meta<typeof SidebarUpgradeSlot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FreeTier: Story = {
  name: "Free tier promo",
  args: { userTier: "free" },
};

export const HiddenForPro: Story = {
  name: "Hidden for Pro",
  args: { userTier: "pro" },
};
