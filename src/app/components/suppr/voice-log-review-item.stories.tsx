import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { VoiceLogReviewItem } from "./voice-log-review-item";
import type { AiLoggedItem } from "../../../lib/nutrition/aiLogging";

const highConfidenceItem: AiLoggedItem = {
  name: "Chicken rice bowl",
  unit: "1 bowl",
  calories: 540,
  protein: 42,
  carbs: 58,
  fat: 14,
  confidence: 0.82,
  source: "voice",
};

const lowConfidenceItem: AiLoggedItem = {
  name: "Handful of nuts",
  unit: "~30 g",
  calories: 180,
  protein: 5,
  carbs: 6,
  fat: 16,
  confidence: 0.38,
  source: "voice",
};

const meta = {
  title: "Suppr/VoiceLogReviewItem",
  component: VoiceLogReviewItem,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    index: 0,
    onChange: () => undefined,
    onRemove: () => undefined,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 480, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof VoiceLogReviewItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HighConfidence: Story = {
  args: { item: highConfidenceItem },
};

export const LowConfidence: Story = {
  args: { item: lowConfidenceItem },
};
