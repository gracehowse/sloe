import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame, MOCK_SHEET_COLORS } from "./_mobileStoryDecorators";
import AiLogReviewSummary from "./AiLogReviewSummary";
import type { AiLoggedItem } from "@suppr/nutrition-core/aiLogging";

const ITEMS: AiLoggedItem[] = [
  {
    name: "Oats",
    calories: 280,
    protein: 10,
    carbs: 48,
    fat: 6,
    confidence: 0.9,
    source: "voice",
  },
  {
    name: "Blueberries",
    calories: 60,
    protein: 1,
    carbs: 14,
    fat: 0,
    confidence: 0.75,
    source: "voice",
  },
];

const meta = {
  title: "Mobile/Components/AiLogReviewSummary",
  component: AiLogReviewSummary,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AiLogReviewSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BreakfastTotals: Story = {
  args: { items: ITEMS, slotLabel: "Breakfast", colors: MOCK_SHEET_COLORS },
};

export const SingleItem: Story = {
  args: { items: [ITEMS[0]], slotLabel: "Lunch", colors: MOCK_SHEET_COLORS },
};
