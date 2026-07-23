import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { WeeklyCheckinBanner } from "./WeeklyCheckinBanner";

const meta = {
  title: "Mobile/Today/WeeklyCheckinBanner",
  component: WeeklyCheckinBanner,
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
  args: { onOpen: () => undefined, onDismiss: () => undefined },
} satisfies Meta<typeof WeeklyCheckinBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const DarkTheme: Story = {
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider scheme="dark">
        <div style={{ width: 360, padding: 16, background: "#1A1A1E" }}>
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
};
