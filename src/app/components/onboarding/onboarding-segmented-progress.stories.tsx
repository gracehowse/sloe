import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OnboardingSegmentedProgress } from "./onboarding-segmented-progress";

const meta = {
  title: "Suppr/Onboarding/OnboardingSegmentedProgress",
  component: OnboardingSegmentedProgress,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    total: 12,
    value: 4,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OnboardingSegmentedProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MidFlow: Story = {};

export const NearComplete: Story = {
  args: { value: 11 },
};

export const JustStarted: Story = {
  args: { value: 1 },
};
