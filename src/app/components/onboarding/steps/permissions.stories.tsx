import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OnboardingStoryShell, onboardingStoryInitial } from "../_storyFixtures";
import { PermissionsStep } from "./permissions";

const meta = {
  title: "Suppr/Onboarding/Steps/Permissions",
  component: PermissionsStep,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("data-bridges", { healthGranted: null, notifGranted: null })}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
} satisfies Meta<typeof PermissionsStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unanswered: Story = {};

export const HealthGranted: Story = {
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("data-bridges", { healthGranted: true, notifGranted: false })}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
};
