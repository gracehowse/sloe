import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OnboardingStoryShell, onboardingStoryInitial } from "../_storyFixtures";
import { DataBridgesStep } from "./data-bridges";

const meta = {
  title: "Suppr/Onboarding/Steps/DataBridges",
  component: DataBridgesStep,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("data-bridges", { appChoice: "mfp" })}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
} satisfies Meta<typeof DataBridgesStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MfpRefugee: Story = {};

export const FreshStart: Story = {
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("data-bridges", { appChoice: "none" })}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
};
