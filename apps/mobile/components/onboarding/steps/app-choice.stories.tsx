import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OnboardingStoryFrame } from "../_storyShell";
import { onboardingStoryInitial } from "../_storyFixtures";
import { MobileAppChoiceStep } from "./app-choice";

const meta = {
  title: "Mobile/Onboarding/Steps/AppChoice",
  component: MobileAppChoiceStep,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <OnboardingStoryFrame initial={onboardingStoryInitial("app-choice")}>
        <Story />
      </OnboardingStoryFrame>
    ),
  ],
} satisfies Meta<typeof MobileAppChoiceStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const Prefilled = {} as Story;
