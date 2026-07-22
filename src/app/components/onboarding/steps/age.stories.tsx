import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OnboardingStoryShell, onboardingStoryInitial } from "../_storyFixtures";
import { AgeStep } from "./age";

const meta = {
  title: "Suppr/Onboarding/Steps/Age",
  component: AgeStep,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("age")}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
} satisfies Meta<typeof AgeStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const YoungAdult: Story = {
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("age", { age: 19 })}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
};
