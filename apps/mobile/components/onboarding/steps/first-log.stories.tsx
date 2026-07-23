import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OnboardingStoryFrame } from "../_storyShell";
import { onboardingStoryInitial } from "../_storyFixtures";
import { FirstLogStep } from "./first-log";

const meta = {
  title: "Mobile/Onboarding/Steps/FirstLog",
  component: FirstLogStep,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <OnboardingStoryFrame initial={onboardingStoryInitial("first-log")}>
        <Story />
      </OnboardingStoryFrame>
    ),
  ],
} satisfies Meta<typeof FirstLogStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const Prefilled = {} as Story;
