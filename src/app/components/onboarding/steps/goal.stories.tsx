import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OnboardingStoryShell, onboardingStoryInitial } from "../_storyFixtures";
import { GoalStep } from "./goal";

const meta = {
  title: "Suppr/Onboarding/Steps/Goal",
  component: GoalStep,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("goal", { goal: null })}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
} satisfies Meta<typeof GoalStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unselected: Story = {};

export const LoseSelected: Story = {
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("goal", { goal: "lose" })}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
};
