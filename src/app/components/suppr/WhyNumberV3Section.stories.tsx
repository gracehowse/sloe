import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { buildWhyThisNumber } from "@/lib/nutrition/whyThisNumber";
import { WhyNumberV3Section } from "./WhyNumberV3Section";

const HIGH_CONFIDENCE = buildWhyThisNumber({
  targetCalories: 1840,
  maintenanceTdee: 2110,
  confidence: "high",
  loggingDays: 21,
  goal: "lose",
  paceKgPerWeek: -0.5,
});

const EARLY_ESTIMATE = buildWhyThisNumber({
  targetCalories: 1900,
  maintenanceTdee: null,
  confidence: "low",
  loggingDays: 5,
  goal: "maintain",
  paceKgPerWeek: 0,
  mealLogDays: 5,
  weightLogCount: 1,
});

const meta = {
  title: "Suppr/WhyNumberV3Section",
  component: WhyNumberV3Section,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Complete Day v3 \"why this number\" breakdown — hero kcal, set-rows, target card, and CTAs.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 440 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    targetCalories: 1840,
    result: HIGH_CONFIDENCE,
    confidence: "high" as const,
    loggingDays: 21,
    onKeepTarget: () => undefined,
    onAdjustTarget: () => undefined,
  },
} satisfies Meta<typeof WhyNumberV3Section>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HighConfidence: Story = {};

export const EarlyEstimate: Story = {
  args: {
    targetCalories: 1900,
    result: EARLY_ESTIMATE,
    confidence: "low",
    loggingDays: 5,
  },
};
