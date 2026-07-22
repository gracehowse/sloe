import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SkeletonList } from "./log-sheet-skeleton-list";

const meta = {
  title: "Suppr/LogSheetSkeletonList",
  component: SkeletonList,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Four-row shimmer shown while Recent / Saved / Library results resolve.",
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
} satisfies Meta<typeof SkeletonList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const InListContext: Story = {
  decorators: [
    (Story) => (
      <div className="rounded-xl border border-border bg-card px-3 py-2">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Recent
        </p>
        <Story />
      </div>
    ),
  ],
};
