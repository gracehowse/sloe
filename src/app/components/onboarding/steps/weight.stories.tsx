import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OnboardingStoryShell, onboardingStoryInitial } from "../_storyFixtures";
import { WeightStep } from "./weight";

const meta = {
  title: "Suppr/Onboarding/Steps/Weight",
  component: WeightStep,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("weight")}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
} satisfies Meta<typeof WeightStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Metric: Story = {};

export const SkippedWeight: Story = {
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("weight", { weightSkipped: true })}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
};
