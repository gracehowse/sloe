import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OnboardingStoryShell, onboardingStoryInitial } from "../_storyFixtures";
import { ActivityStep } from "./activity";

const meta = {
  title: "Suppr/Onboarding/Steps/Activity",
  component: ActivityStep,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("activity", { activity: null })}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
} satisfies Meta<typeof ActivityStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unselected: Story = {};

export const ModerateSelected: Story = {
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("activity", { activity: "moderate" })}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
};
