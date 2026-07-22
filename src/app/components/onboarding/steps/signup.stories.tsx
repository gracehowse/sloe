import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OnboardingStoryShell, onboardingStoryInitial } from "../_storyFixtures";
import { SignupStep } from "./signup";

const meta = {
  title: "Suppr/Onboarding/Steps/Signup",
  component: SignupStep,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("signup", { authMethod: null })}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
} satisfies Meta<typeof SignupStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MethodPicker: Story = {};

export const EmailSelected: Story = {
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("signup", { authMethod: "email" })}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
};
