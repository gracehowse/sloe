import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Digest } from "./digest";

const SUCCESS_ARGS = {
  weekKey: "2026-W29",
  weekLabel: "14–20 Jul",
  daysLogged: 6,
  mealsLogged: 18,
  headline: "A steady, consistent week.",
  stats: {
    streakDays: 12,
    streakFreezesAvailable: 1,
    avgCalories: 2040,
    avgProtein: 128,
    proteinAdherencePct: 86,
    weightDeltaKg: -0.4,
    weightFirstKg: 72.1,
    weightLastKg: 71.7,
  },
  narrative: {
    closestToTarget: { label: "Wednesday", protein: 135, calories: 2080 },
    maintenanceLine: "Adaptive maintenance sits ~50 kcal under the formula.",
    usualMeal: {
      kind: "celebration" as const,
      name: "Oats + berries",
      count: 4,
    },
    weeklyCheckin: null,
  },
  shareText: "My week on Sloe — 6 days logged, 12-day streak.",
  onShare: () => undefined,
  onDismiss: () => undefined,
  onRetry: () => undefined,
};

const meta = {
  title: "Suppr/Digest",
  component: Digest,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Weekly digest / week-at-a-glance card on Progress — loading, empty, success, error, offline.",
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
} satisfies Meta<typeof Digest>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {
  args: { ...SUCCESS_ARGS, state: "success" },
};

export const Loading: Story = {
  args: { ...SUCCESS_ARGS, state: "loading" },
};

export const Empty: Story = {
  args: {
    ...SUCCESS_ARGS,
    state: "empty",
    daysLogged: 0,
    mealsLogged: 0,
    headline: "",
    stats: {
      ...SUCCESS_ARGS.stats,
      weightDeltaKg: null,
      weightFirstKg: null,
      weightLastKg: null,
      proteinAdherencePct: null,
    },
    narrative: {
      closestToTarget: null,
      maintenanceLine: null,
      usualMeal: null,
      weeklyCheckin: null,
    },
  },
};

export const ErrorState: Story = {
  name: "Error",
  args: { ...SUCCESS_ARGS, state: "error" },
};

export const Offline: Story = {
  args: {
    ...SUCCESS_ARGS,
    state: "offline",
    offlineSyncedLabel: "synced 2h ago",
  },
};
