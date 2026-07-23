import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OnboardingStoryShell, onboardingStoryInitial } from "../_storyFixtures";
import { UpgradeStep } from "./upgrade";

const meta = {
  title: "Suppr/Onboarding/Steps/Upgrade",
  component: UpgradeStep,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("upgrade")}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
} satisfies Meta<typeof UpgradeStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TrialSelected: Story = {
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("upgrade", { trialChoice: "trial" })}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
};
