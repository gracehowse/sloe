import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OnboardingStoryShell, onboardingStoryInitial } from "../_storyFixtures";
import { StrategyStep } from "./strategy";

const meta = {
  title: "Suppr/Onboarding/Steps/Strategy",
  component: StrategyStep,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("strategy", { nutritionStrategy: null })}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
} satisfies Meta<typeof StrategyStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unselected: Story = {};

export const BalancedSelected: Story = {
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("strategy", { nutritionStrategy: "balanced" })}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
};
