import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OnboardingStoryShell, onboardingStoryInitial } from "../_storyFixtures";
import { WelcomeStep } from "./welcome";

const meta = {
  title: "Suppr/Onboarding/Steps/Welcome",
  component: WelcomeStep,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("welcome")} brand minHeight={844}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
} satisfies Meta<typeof WelcomeStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BrandScreen: Story = {};

export const TallViewport: Story = {
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("welcome")} brand minHeight={920}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
};
