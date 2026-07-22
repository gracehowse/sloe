import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DigestBlended } from "./digest-blended";

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
  onAdjustPace: () => undefined,
  blendedExtras: {
    closestDayTargetCalories: 2100,
    patternWindowLabel: "last 4 weeks",
    dayOfWeekPattern: {
      highDay: "Saturday",
      lowDay: "Tuesday",
      deltaKcal: 280,
      highDayAvg: 2280,
      lowDayAvg: 2000,
    },
  },
};

const meta = {
  title: "Suppr/DigestBlended",
  component: DigestBlended,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Merged premium week-digest card — closest-day hero, metric strip, pattern row, and share.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 440, background: "var(--background)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DigestBlended>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {
  args: { ...SUCCESS_ARGS, state: "success" },
};

export const Empty: Story = {
  args: {
    ...SUCCESS_ARGS,
    state: "empty",
    daysLogged: 0,
    mealsLogged: 0,
    headline: "Quiet week",
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
    blendedExtras: {
      closestDayTargetCalories: null,
      patternWindowLabel: null,
      dayOfWeekPattern: null,
    },
  },
};

export const Loading: Story = {
  args: { ...SUCCESS_ARGS, state: "loading" },
};
