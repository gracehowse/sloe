import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OnboardingStoryShell, onboardingStoryInitial } from "./_storyFixtures";
import { OnboardingRecipeImportCard } from "./OnboardingRecipeImportCard";

const meta = {
  title: "Suppr/Onboarding/OnboardingRecipeImportCard",
  component: OnboardingRecipeImportCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("data-bridges")}>
        <div style={{ padding: 16 }}>
          <Story />
        </div>
      </OnboardingStoryShell>
    ),
  ],
} satisfies Meta<typeof OnboardingRecipeImportCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {};

export const TallCard: Story = {
  decorators: [
    (Story) => (
      <OnboardingStoryShell initial={onboardingStoryInitial("data-bridges")}>
        <div style={{ padding: 16, width: 420 }}>
          <Story />
        </div>
      </OnboardingStoryShell>
    ),
  ],
};
