import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgressDigestBlock } from "./progress-digest-block";
import type { DigestWeekView } from "../../../lib/nutrition/weeklyRecap";
import type { UsualMealRecapInsight } from "../../../lib/nutrition/weeklyRecap";

const recap: DigestWeekView = {
  weekKey: "2026-W29",
  weekLabel: "14–20 Jul",
  weekDayKeys: [
    "2026-07-14",
    "2026-07-15",
    "2026-07-16",
    "2026-07-17",
    "2026-07-18",
    "2026-07-19",
    "2026-07-20",
  ],
  loggedDayKeys: ["2026-07-14", "2026-07-15", "2026-07-16", "2026-07-17", "2026-07-18", "2026-07-19"],
  daysLogged: 6,
  avgCalories: 2040,
  avgProtein: 128,
  proteinAdherencePct: 86,
  streakLength: 12,
  freezesAvailable: 1,
  bestDay: {
    key: "2026-07-16",
    label: "Wednesday",
    calories: 2080,
    protein: 135,
    targetCalories: 2000,
  },
  weightDeltaKg: -0.4,
  weightFirstKg: 72.1,
  weightLastKg: 71.7,
  avgFiberG: 22,
  fiberAdherencePct: 78,
  avgHydrationMl: 1800,
  hydrationDaysOnTarget: 5,
  dayOfWeekPattern: null,
  patternWindowLabel: null,
};

const usualMealCelebration: UsualMealRecapInsight = {
  kind: "celebration",
  name: "Oats + berries",
  count: 4,
};

const nutritionByDay = {
  "2026-07-14": [
    {
      id: "meal-1",
      name: "Breakfast",
      recipeTitle: "Oats",
      time: "8:00 AM",
      calories: 420,
      protein: 18,
      carbs: 55,
      fat: 12,
    },
  ],
  "2026-07-15": [
    {
      id: "meal-2",
      name: "Lunch",
      recipeTitle: "Salad",
      time: "12:30 PM",
      calories: 610,
      protein: 42,
      carbs: 38,
      fat: 22,
    },
  ],
};

const baseArgs = {
  digestBlendEnabled: true,
  digestVisible: true,
  recap,
  usualMealInsight: usualMealCelebration,
  nutritionByDay,
  recapMaintenance: {
    kcal: 2180,
    source: "adaptive" as const,
    confidence: "high" as const,
    formulaKcal: 2100,
    adaptiveRejectedAsStale: false,
    adaptiveRejectedBelowFormula: false,
    rejectedAdaptiveKcal: null,
    measuredRejectedBelowFormula: false,
    rejectedMeasuredKcal: null,
  },
  adaptiveTdee: 2180,
  adaptiveConfidence: "high",
  staticTdee: 2100,
  previousWeekTdeeKcal: 2190,
  targetsCalories: 2000,
  targetsProtein: 150,
  digestProteinOnTarget: 5,
  weightSurfaceMode: "show" as const,
  onDismiss: () => undefined,
};

const meta = {
  title: "Suppr/ProgressDigestBlock",
  component: ProgressDigestBlock,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          "Legacy Progress digest host — blended Digest card and/or DigestStoryCard depending on `digestBlendEnabled`.",
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
  args: baseArgs,
} satisfies Meta<typeof ProgressDigestBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BlendedDigest: Story = {
  name: "Blended digest (flag on)",
  args: { digestBlendEnabled: true, digestVisible: true },
};

export const LegacyStoryCard: Story = {
  name: "Legacy story card only",
  args: { digestBlendEnabled: false, digestVisible: true },
};
