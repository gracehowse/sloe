import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OnboardingStoryFrame } from "../_storyShell";
import { onboardingStoryInitial } from "../_storyFixtures";
import { MobileWeightStep } from "./weight";

const meta = {
  title: "Mobile/Onboarding/Steps/Weight",
  component: MobileWeightStep,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <OnboardingStoryFrame initial={onboardingStoryInitial("weight")}>
        <Story />
      </OnboardingStoryFrame>
    ),
  ],
} satisfies Meta<typeof MobileWeightStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const Prefilled = {} as Story;
