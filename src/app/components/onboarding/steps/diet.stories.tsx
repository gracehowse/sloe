import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OnboardingStoryShell, onboardingStoryInitial } from "../_storyFixtures";
import { DietStep } from "./diet";

const meta = {
  title: "Suppr/Onboarding/Steps/Diet",
  component: DietStep,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("diet", { diet: [] })}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
} satisfies Meta<typeof DietStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoneSelected: Story = {};

export const VegetarianSelected: Story = {
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("diet", { diet: ["vegetarian"] })}>
        <Story />
      </OnboardingStoryShell>
    ),
  ],
};
