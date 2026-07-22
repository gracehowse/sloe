import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { WeeklyRecapDetailRow } from "@/lib/nutrition-core/weeklyRecapDetailRows";
import { WeeklyRecapDetailRows } from "./WeeklyRecapDetailRows";

const FULL_ROWS: WeeklyRecapDetailRow[] = [
  { id: "weight", title: "Weight", subtitle: "−0.4 kg this week" },
  { id: "streak", title: "Best streak", subtitle: "12 days and counting" },
  { id: "most-cooked", title: "Most-cooked", subtitle: "Miso salmon bowl ×4" },
  { id: "protein", title: "Protein average", subtitle: "128 g / day" },
];

const meta = {
  title: "Suppr/WeeklyRecapDetailRows",
  component: WeeklyRecapDetailRows,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Divided detail rows beneath the shareable weekly recap card — weight, streak, most-cooked, protein.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 440 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    rows: FULL_ROWS,
  },
} satisfies Meta<typeof WeeklyRecapDetailRows>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Partial: Story = {
  args: {
    rows: FULL_ROWS.slice(0, 2),
  },
};
