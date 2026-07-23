import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { TodayScrollSectionHeader } from "./TodayScrollSectionHeader";

const meta = {
  title: "Mobile/Today/TodayScrollSectionHeader",
  component: TodayScrollSectionHeader,
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
  args: { title: "Activity", subtitle: "Sunday, 21 June" },
} satisfies Meta<typeof TodayScrollSectionHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithSubtitle: Story = {};
export const TitleOnly: Story = { args: { title: "Hydration & stimulants", subtitle: undefined } };
