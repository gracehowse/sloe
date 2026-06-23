import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CsvImportPreview } from "./CsvImportPreview";
import type { CsvSampleRow } from "@/lib/imports/useCsvImportFlow";

/**
 * CsvImportPreview (web) — the confirm step of the two-phase MFP-refugee CSV
 * import (ENG-1234). Pins the preview states Chromatic guards: a clean
 * import, an import with skipped + truncated notes, and the committing
 * (busy CTA) state. Mobile mirror lives at
 * `apps/mobile/components/imports/CsvImportPreview.tsx`.
 */
const SAMPLE: CsvSampleRow[] = [
  { date: "2024-08-12", meal: "breakfast", name: "Overnight oats with banana", calories: 420, protein: 14, carbs: 68, fat: 10 },
  { date: "2024-08-12", meal: "lunch", name: "Chicken Caesar salad", calories: 540, protein: 52, carbs: 18, fat: 28 },
  { date: "2024-08-12", meal: "dinner", name: "Salmon, rice & greens", calories: 620, protein: 48, carbs: 52, fat: 22 },
  { date: "2024-08-12", meal: "snack", name: "Greek yoghurt & berries", calories: 180, protein: 17, carbs: 14, fat: 4 },
  { date: "2024-08-13", meal: "breakfast", name: "Scrambled eggs on toast", calories: 360, protein: 22, carbs: 26, fat: 18 },
  { date: "2024-08-13", meal: "lunch", name: "Turkey & avocado wrap", calories: 480, protein: 34, carbs: 42, fat: 19 },
  { date: "2024-08-13", meal: "dinner", name: "Beef stir-fry with noodles", calories: 660, protein: 41, carbs: 64, fat: 24 },
  { date: "2024-08-13", meal: "snack", name: "Protein shake", calories: 160, protein: 30, carbs: 6, fat: 2 },
];

const meta = {
  title: "Suppr/CsvImportPreview",
  component: CsvImportPreview,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
  args: {
    onConfirm: () => {},
    onCancel: () => {},
  },
  decorators: [
    (Story) => (
      <div
        style={{
          width: 380,
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 20,
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CsvImportPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    source: "mfp",
    total: 247,
    unmatched: 0,
    truncated: false,
    sample: SAMPLE,
    committing: false,
  },
};

export const SkippedAndTruncated: Story = {
  args: {
    source: "lose-it",
    total: 1000,
    unmatched: 3,
    truncated: true,
    sample: SAMPLE,
    committing: false,
  },
};

export const Committing: Story = {
  args: {
    source: "cronometer",
    total: 247,
    unmatched: 0,
    truncated: false,
    sample: SAMPLE,
    committing: true,
  },
};
