import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OnboardingSegmentedProgress } from "./OnboardingSegmentedProgress";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Onboarding/OnboardingSegmentedProgress",
  component: OnboardingSegmentedProgress,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider>
        <div style={{ width: 360, padding: 16, background: "#F7F6FA" }}>
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
  parameters: { layout: "fullscreen" },
  args: { current: 3, total: 12 },
} satisfies Meta<typeof OnboardingSegmentedProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MidFlow = {} as Story;
export const NearEnd: Story = { args: { current: 11, total: 12 } };
