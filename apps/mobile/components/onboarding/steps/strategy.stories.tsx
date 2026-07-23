import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OnboardingStoryFrame } from "../_storyShell";
import { onboardingStoryInitial } from "../_storyFixtures";
import { MobileStrategyStep } from "./strategy";

const meta = {
  title: "Mobile/Onboarding/Steps/Strategy",
  component: MobileStrategyStep,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <OnboardingStoryFrame initial={onboardingStoryInitial("strategy")}>
        <Story />
      </OnboardingStoryFrame>
    ),
  ],
} satisfies Meta<typeof MobileStrategyStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const Prefilled = {} as Story;
