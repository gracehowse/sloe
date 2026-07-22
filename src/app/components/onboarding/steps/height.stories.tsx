import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OnboardingStoryShell, onboardingStoryInitial } from "../_storyFixtures";
import { HeightStep } from "./height";

const meta = {
  title: "Suppr/Onboarding/Steps/Height",
  component: HeightStep,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("height")}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
} satisfies Meta<typeof HeightStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Metric: Story = {};

export const Imperial: Story = {
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("height", { unitSystem: "imperial" })}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
};
