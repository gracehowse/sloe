import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { PostOnboardingPushExplainer } from "./PostOnboardingPushExplainer";

const meta = {
  title: "Mobile/Today/PostOnboardingPushExplainer",
  component: PostOnboardingPushExplainer,
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
  args: { visible: true, onSkip: () => undefined, onEnable: () => undefined },
} satisfies Meta<typeof PostOnboardingPushExplainer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Visible: Story = {};
export const Hidden: Story = { args: { visible: false } };
