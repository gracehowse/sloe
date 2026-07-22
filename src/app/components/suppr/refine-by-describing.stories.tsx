import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RefineByDescribing } from "./refine-by-describing";
import type { PhotoLogItemRanged } from "../../../lib/nutrition/photoLogRanges";

const PHOTO_ITEMS: PhotoLogItemRanged[] = [
  {
    id: "photo-1",
    name: "Grilled salmon",
    category: "Protein + fats",
    source: "ai",
    calories: { low: 320, high: 420 },
    protein: { low: 28, high: 36 },
    carbs: { low: 0, high: 4 },
    fat: { low: 18, high: 24 },
    confidence: "medium",
  },
  {
    id: "photo-2",
    name: "Roasted potatoes",
    category: "Extras",
    source: "ai",
    calories: { low: 180, high: 260 },
    protein: { low: 3, high: 5 },
    carbs: { low: 32, high: 42 },
    fat: { low: 4, high: 8 },
    confidence: "low",
  },
];

function PhotoRefineHarness() {
  return (
    <RefineByDescribing
      source="photo"
      items={PHOTO_ITEMS}
      notes="Lunch bowl"
      round={1}
      onRoundComplete={() => undefined}
      onRefined={() => undefined}
    />
  );
}

function VoiceRoundLimitHarness() {
  return (
    <RefineByDescribing
      source="voice"
      items={[{ name: "Omelette", calories: 280, protein: 18, carbs: 2, fat: 20 }]}
      transcript="Two egg omelette with cheese"
      round={4}
      onRoundComplete={() => undefined}
      onRefined={() => undefined}
    />
  );
}

const meta = {
  title: "Suppr/RefineByDescribing",
  component: PhotoRefineHarness,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Photo/voice log refine input — POSTs to `/api/nutrition/refine-log` on submit (idle state only in Storybook).",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PhotoRefineHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PhotoReview: Story = {
  name: "Photo review (round 1)",
};

export const RoundLimit: StoryObj = {
  name: "Round limit reached",
  render: () => <VoiceRoundLimitHarness />,
};
