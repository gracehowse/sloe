import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TodayRecentsRow } from "./today-recents-row";
import type { FoodHistoryItem } from "../../../lib/nutrition/foodHistory";

const recents: FoodHistoryItem[] = [
  {
    recipeTitle: "Greek yogurt",
    calories: 120,
    protein: 15,
    carbs: 8,
    fat: 2,
    count: 12,
    source: "manual",
  },
  {
    recipeTitle: "Chicken rice bowl",
    calories: 540,
    protein: 42,
    carbs: 58,
    fat: 14,
    count: 4,
    source: "barcode",
  },
  {
    recipeTitle: "Oats with berries",
    calories: 380,
    protein: 12,
    carbs: 62,
    fat: 8,
    count: 9,
    source: "ai_voice",
  },
];

const meta = {
  title: "Suppr/TodayRecentsRow",
  component: TodayRecentsRow,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    onReLog: () => undefined,
    onOpenAll: () => undefined,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 390, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TodayRecentsRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithRecents: Story = {
  args: { recents },
};

export const Empty: Story = {
  args: { recents: [] },
};
