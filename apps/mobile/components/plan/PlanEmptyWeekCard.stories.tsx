import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { PlanEmptyWeekCard } from "./PlanEmptyWeekCard";

const meta = {
  title: "Mobile/Plan/PlanEmptyWeekCard",
  component: PlanEmptyWeekCard,
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
  args: { onGenerate: () => undefined, onAddMealsAsYouGo: () => undefined },
} satisfies Meta<typeof PlanEmptyWeekCard>;

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
