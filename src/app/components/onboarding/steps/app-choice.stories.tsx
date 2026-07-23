import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OnboardingStoryShell, onboardingStoryInitial } from "../_storyFixtures";
import { AppChoiceStep } from "./app-choice";

const meta = {
  title: "Suppr/Onboarding/Steps/AppChoice",
  component: AppChoiceStep,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("app-choice", { appChoice: null })}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
} satisfies Meta<typeof AppChoiceStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unselected: Story = {};

export const MfpHighlighted: Story = {
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("app-choice", { appChoice: "mfp" })}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
};
