import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgressActivitySection } from "./progress-activity-section";
import type { HealthSnapshot } from "@/lib/health/healthSnapshots";

const FRESH_SNAPSHOT: HealthSnapshot = {
  capturedAt: "2026-06-21T11:30:00Z",
  steps: 8432,
  activeEnergyKcal: 412,
  restingBurnKcal: 1580,
  weightKg: 72.4,
  source: "HealthKit",
  deviceId: "iphone-1",
};

const STEPS_CHART = [
  { date: "Mon", value: 6200 },
  { date: "Tue", value: 8100 },
  { date: "Wed", value: 5400 },
  { date: "Thu", value: 9200 },
  { date: "Fri", value: 7800 },
  { date: "Sat", value: 11000 },
  { date: "Sun", value: 8432 },
];

const legacyArgs = {
  fetchSnapshot: () => Promise.resolve(FRESH_SNAPSHOT),
  useImperial: false,
  stepsByDay: { "2026-07-22": 8432 },
  dailyStepsGoal: 10000,
  stepsChartData: STEPS_CHART,
  stepsInput: "8432",
  setStepsInput: () => undefined,
  saveTodaySteps: () => undefined,
  bodyFatPct: 22.4,
  bodyFatInput: "22.4",
  setBodyFatInput: () => undefined,
  saveBodyFat: () => undefined,
};

const meta = {
  title: "Suppr/ProgressActivitySection",
  component: ProgressActivitySection,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Progress activity block — Apple Health card when `web_apple_health_card` is forced on; legacy steps + body-fat cards otherwise.",
      },
    },
  },
  decorators: [
    (Story, ctx) => {
      const w = window as Window & { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> };
      w.__SUPPR_FORCE_FLAGS__ = {
        ...(w.__SUPPR_FORCE_FLAGS__ ?? {}),
        web_apple_health_card: ctx.parameters.forceAppleHealth === true,
      };
      return (
        <div style={{ maxWidth: 440, background: "var(--bg)", padding: 16 }}>
          <Story />
        </div>
      );
    },
  ],
  args: legacyArgs,
} satisfies Meta<typeof ProgressActivitySection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LegacyManualCards: Story = {
  name: "Legacy manual steps + body fat",
  parameters: { forceAppleHealth: false },
};

export const AppleHealthCard: Story = {
  name: "Apple Health card (flag on)",
  parameters: { forceAppleHealth: true },
};
