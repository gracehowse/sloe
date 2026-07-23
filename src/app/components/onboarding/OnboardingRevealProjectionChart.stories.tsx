import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { computeOnboardingRevealProjection } from "@/lib/onboarding/revealProjection";
import { OnboardingRevealProjectionChart } from "./OnboardingRevealProjectionChart";

const loseProjection = computeOnboardingRevealProjection({
  goal: "lose",
  weightKg: 72,
  paceKgPerWeek: 0.5,
  weightSkipped: false,
})!;

const gainProjection = computeOnboardingRevealProjection({
  goal: "gain",
  weightKg: 62,
  paceKgPerWeek: 0.35,
  weightSkipped: false,
})!;

const meta = {
  title: "Suppr/Onboarding/OnboardingRevealProjectionChart",
  component: OnboardingRevealProjectionChart,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    projection: loseProjection,
    animate: false,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 360 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OnboardingRevealProjectionChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoseGoal: Story = {};

export const GainGoal: Story = {
  args: { projection: gainProjection },
};

export const AnimatedStroke: Story = {
  args: { animate: true },
};
