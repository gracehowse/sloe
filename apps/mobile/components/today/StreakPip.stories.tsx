import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { StreakPip } from "./StreakPip";

const meta = {
  title: "Mobile/Today/StreakPip",
  component: StreakPip,
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
  args: { days: 5, onPress: () => undefined },
} satisfies Meta<typeof StreakPip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ActiveStreak: Story = {};
export const FreezeProtected: Story = { args: { days: 3, freezeProtected: true, size: "lg" } };
