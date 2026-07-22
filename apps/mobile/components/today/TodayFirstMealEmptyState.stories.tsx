import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { TodayFirstMealEmptyState } from "./TodayFirstMealEmptyState";

const meta = {
  title: "Mobile/Today/TodayFirstMealEmptyState",
  component: TodayFirstMealEmptyState,
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
  args: { onLogMeal: () => undefined, onDismissTip: () => undefined, isBrandNew: true, tipDismissed: false },
} satisfies Meta<typeof TodayFirstMealEmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BrandNewWithTip: Story = {};
export const Returning: Story = { args: { isBrandNew: false } };
