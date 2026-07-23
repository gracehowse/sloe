import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OnboardingStoryShell, onboardingStoryInitial } from "../_storyFixtures";
import { RevealStep } from "./reveal";

const meta = {
  title: "Suppr/Onboarding/Steps/Reveal",
  component: RevealStep,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("reveal")}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
} satisfies Meta<typeof RevealStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Compact: Story = {
  args: { compact: true },
};
