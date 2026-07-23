import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OnboardingStoryFrame } from "../_storyShell";
import { onboardingStoryInitial } from "../_storyFixtures";
import { MobileRevealStep } from "./reveal";

const meta = {
  title: "Mobile/Onboarding/Steps/Reveal",
  component: MobileRevealStep,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <OnboardingStoryFrame initial={onboardingStoryInitial("reveal")}>
        <Story />
      </OnboardingStoryFrame>
    ),
  ],
} satisfies Meta<typeof MobileRevealStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const Prefilled = {} as Story;
