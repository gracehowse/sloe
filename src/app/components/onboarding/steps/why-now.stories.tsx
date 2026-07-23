import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OnboardingStoryShell, onboardingStoryInitial } from "../_storyFixtures";
import { WhyNowStep } from "./why-now";

const meta = {
  title: "Suppr/Onboarding/Steps/WhyNow",
  component: WhyNowStep,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("why-now", { whyNow: null })}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
} satisfies Meta<typeof WhyNowStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unselected: Story = {};

export const FeelBetterSelected: Story = {
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("why-now", { whyNow: "feel-better" })}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
};
