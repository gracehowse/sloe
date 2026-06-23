import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AppleHealthCard } from "./apple-health-card";
import type { HealthSnapshot } from "@/lib/health/healthSnapshots";

/**
 * AppleHealthCard (web) — the read-only health rows synced from the iOS app,
 * wired into Progress behind `web_apple_health_card` (ENG-1225 gap #21). Pins
 * the ready / empty states so Chromatic guards them.
 *
 * `nowProvider` is fixed so the "synced N ago / stale" logic is deterministic.
 */
const NOW = new Date("2026-06-21T12:00:00Z");
const FRESH: HealthSnapshot = {
  capturedAt: "2026-06-21T11:30:00Z", // 30 min ago → fresh
  steps: 8432,
  activeEnergyKcal: 412,
  restingBurnKcal: 1580,
  weightKg: 72.4,
  source: "HealthKit",
  deviceId: "iphone-1",
};
const STALE: HealthSnapshot = {
  ...FRESH,
  capturedAt: "2026-06-18T09:00:00Z", // 3 days ago → stale badge
  weightKg: null, // also exercises the "No weigh-in today" hint
};

const meta = {
  title: "Suppr/AppleHealthCard",
  component: AppleHealthCard,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 480, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AppleHealthCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
  name: "Ready (synced)",
  args: {
    fetchSnapshot: () => Promise.resolve(FRESH),
    nowProvider: () => NOW,
  },
};

export const Stale: Story = {
  name: "Stale + no weigh-in",
  args: {
    fetchSnapshot: () => Promise.resolve(STALE),
    nowProvider: () => NOW,
  },
};

export const Empty: Story = {
  name: "Empty (never synced)",
  args: {
    fetchSnapshot: () => Promise.resolve(null),
    nowProvider: () => NOW,
  },
};
