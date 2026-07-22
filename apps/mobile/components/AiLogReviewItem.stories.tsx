import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame, MOCK_SHEET_COLORS } from "./_mobileStoryDecorators";
import AiLogReviewItem from "./AiLogReviewItem";
import type { AiLoggedItem } from "@suppr/nutrition-core/aiLogging";

const ITEM: AiLoggedItem = {
  name: "Greek yogurt with berries",
  quantity: 1,
  unit: "bowl",
  grams: 180,
  calories: 220,
  protein: 18,
  carbs: 24,
  fat: 6,
  confidence: 0.82,
  source: "voice",
};

const LOW_ITEM: AiLoggedItem = {
  ...ITEM,
  name: "Mystery sandwich",
  confidence: 0.42,
  source: "photo",
};

const meta = {
  title: "Mobile/Components/AiLogReviewItem",
  component: AiLogReviewItem,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AiLogReviewItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HighConfidence: Story = {
  args: {
    item: ITEM,
    index: 0,
    colors: MOCK_SHEET_COLORS,
    onChange: () => undefined,
    onRemove: () => undefined,
  },
};

export const LowConfidence: Story = {
  args: {
    item: LOW_ITEM,
    index: 1,
    colors: MOCK_SHEET_COLORS,
    onChange: () => undefined,
    onRemove: () => undefined,
  },
};
