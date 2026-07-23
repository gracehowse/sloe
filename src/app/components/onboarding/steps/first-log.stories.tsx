import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OnboardingStoryShell, onboardingStoryInitial } from "../_storyFixtures";
import { FirstLogStep } from "./first-log";

const meta = {
  title: "Suppr/Onboarding/Steps/FirstLog",
  component: FirstLogStep,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("first-log")}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
} satisfies Meta<typeof FirstLogStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TallViewport: Story = {
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("first-log")} minHeight={920}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
};
