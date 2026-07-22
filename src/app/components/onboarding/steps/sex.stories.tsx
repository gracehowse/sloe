import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OnboardingStoryShell, onboardingStoryInitial } from "../_storyFixtures";
import { SexStep } from "./sex";

const meta = {
  title: "Suppr/Onboarding/Steps/Sex",
  component: SexStep,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("sex", { sex: null })}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
} satisfies Meta<typeof SexStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unselected: Story = {};

export const FemaleSelected: Story = {
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("sex", { sex: "female" })}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
};
