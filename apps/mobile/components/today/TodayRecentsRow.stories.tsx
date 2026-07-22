import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { FoodHistoryItem } from "@suppr/nutrition-core/foodHistory";

const recents: FoodHistoryItem[] = [
  { recipeTitle: "Greek yogurt", calories: 120, protein: 15, carbs: 8, fat: 2, count: 12, source: "manual" },
  { recipeTitle: "Chicken rice bowl", calories: 540, protein: 42, carbs: 58, fat: 14, count: 4, source: "barcode" },
];

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { TodayRecentsRow } from "./TodayRecentsRow";

const meta = {
  title: "Mobile/Today/TodayRecentsRow",
  component: TodayRecentsRow,
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
  args: { recents, onReLog: noop, onOpenAll: noop },
} satisfies Meta<typeof TodayRecentsRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithRecents: Story = {};
export const Empty: Story = { args: { recents: [] } };
