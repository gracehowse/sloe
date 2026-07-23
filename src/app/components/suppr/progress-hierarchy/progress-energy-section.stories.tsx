import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgressEnergySection } from "./progress-energy-section";

const meta = {
  title: "Suppr/ProgressHierarchy/ProgressEnergySection",
  component: ProgressEnergySection,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "§3 Energy — deficit-led card with maintenance − intake equation and optional thin-data bars.",
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
} satisfies Meta<typeof ProgressEnergySection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AdaptiveDeficit: Story = {
  name: "Adaptive deficit (enough data)",
  args: {
    avgIntakeKcal: 1840,
    hasEnoughData: true,
    resolved: {
      kcal: 2073,
      source: "adaptive",
      confidence: "high",
      formulaKcal: 2000,
      adaptiveRejectedAsStale: false,
      adaptiveRejectedBelowFormula: false,
      rejectedAdaptiveKcal: null,
      measuredRejectedBelowFormula: false,
      rejectedMeasuredKcal: null,
    },
    latestWeightKg: 72.4,
    goalWeightKg: 68,
    adaptiveProgress: null,
    sex: "female",
    weightKg: 72.4,
    heightCm: 165,
    age: 30,
    activityLevel: "moderate",
    planPace: "steady",
    userGoal: "lose",
    goalCalories: 1500,
  },
};

export const BuildingEstimate: Story = {
  name: "Building estimate (thin data)",
  args: {
    avgIntakeKcal: 1650,
    hasEnoughData: false,
    resolved: {
      kcal: 2000,
      source: "formula",
      confidence: "low",
      formulaKcal: 2000,
      adaptiveRejectedAsStale: false,
      adaptiveRejectedBelowFormula: false,
      rejectedAdaptiveKcal: null,
      measuredRejectedBelowFormula: false,
      rejectedMeasuredKcal: null,
    },
    latestWeightKg: 72.4,
    goalWeightKg: 68,
    adaptiveProgress: {
      weighIns: 1,
      weighInsTarget: 4,
      loggingDays: 2,
      loggingDaysTarget: 14,
      excludedPartialDays: 1,
      windowDays: 28,
      ready: false,
      message: "Log 2 more full days and 3 more weigh-ins.",
    },
    sex: "female",
    weightKg: 72.4,
    heightCm: 165,
    age: 30,
    activityLevel: "moderate",
    planPace: "steady",
    userGoal: "lose",
    goalCalories: 1500,
  },
};
