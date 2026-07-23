import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { CsvImportPreview } from "./CsvImportPreview";

const SAMPLE = [
  { date: "2026-07-01", slot: "breakfast", name: "Oats", calories: 320, protein: 12, carbs: 48, fat: 8 },
  { date: "2026-07-01", slot: "lunch", name: "Chicken salad", calories: 410, protein: 35, carbs: 18, fat: 16 },
];

const meta = {
  title: "Mobile/Imports/CsvImportPreview",
  component: CsvImportPreview,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CsvImportPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReadyToCommit: Story = {
  args: {
    source: "mfp",
    total: 42,
    unmatched: 2,
    truncated: false,
    sample: SAMPLE,
    committing: false,
    onConfirm: () => undefined,
    onCancel: () => undefined,
  },
};

export const Committing: Story = {
  args: {
    source: "mfp",
    total: 42,
    unmatched: 0,
    truncated: true,
    sample: SAMPLE,
    committing: true,
    onConfirm: () => undefined,
    onCancel: () => undefined,
  },
};
