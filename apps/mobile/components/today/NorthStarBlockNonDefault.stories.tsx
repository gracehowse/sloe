import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { NorthStarBlockNonDefault } from "./NorthStarBlockNonDefault";

const meta = {
  title: "Mobile/Today/NorthStarBlockNonDefault",
  component: NorthStarBlockNonDefault,
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
  args: { kind: "over-budget", overBudgetStage: "over", overBudgetCalories: { consumed: 2350, goal: 2100 }, onBrowse: () => undefined },
} satisfies Meta<typeof NorthStarBlockNonDefault>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OverBudget: Story = {};
export const LibraryEmpty: Story = { args: { kind: "library-empty" } };
