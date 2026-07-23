import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OnboardingStoryShell, onboardingStoryInitial } from "../_storyFixtures";
import { PaceStep } from "./pace";

const meta = {
  title: "Suppr/Onboarding/Steps/Pace",
  component: PaceStep,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("pace", { goal: "lose", paceKgPerWeek: 0.5 })}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
} satisfies Meta<typeof PaceStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SustainablePace: Story = {};

export const AggressivePace: Story = {
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("pace", { goal: "lose", paceKgPerWeek: 1.0 })}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
};
