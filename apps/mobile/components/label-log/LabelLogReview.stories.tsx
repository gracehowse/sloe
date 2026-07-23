import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame, MOCK_SHEET_COLORS } from "../_mobileStoryDecorators";
import { LabelLogReview } from "./LabelLogReview";

const meta = {
  title: "Mobile/LabelLog/LabelLogReview",
  component: LabelLogReview,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof LabelLogReview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Reviewing: Story = {
  args: {
    fields: {
      name: "Granola bar",
      servingSizeG: "40",
      calories: "180",
      protein: "4",
      carbs: "24",
      fat: "8",
    },
    warning: "Double-check the label numbers before logging.",
    error: null,
    saving: false,
    activeSlot: "Snack",
    colors: MOCK_SHEET_COLORS,
    onUpdate: () => undefined,
    onCapture: () => undefined,
    onCommit: () => undefined,
  },
};

export const Saving: Story = {
  args: {
    fields: {
      name: "Protein shake",
      servingSizeG: "330",
      calories: "220",
      protein: "30",
      carbs: "8",
      fat: "3",
    },
    warning: "Double-check the label numbers before logging.",
    error: null,
    saving: true,
    activeSlot: "Lunch",
    colors: MOCK_SHEET_COLORS,
    onUpdate: () => undefined,
    onCapture: () => undefined,
    onCommit: () => undefined,
  },
};
