import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgressWeightEmptyState } from "./progress-weight-empty-state";

/**
 * ProgressWeightEmptyState — ENG-1372 slice 2. The Progress weight card's
 * 0/1-weigh-in sparse state. ALWAYS renders a chart frame (law 1): 0 points
 * gets an axis + optional goal band + a filled CTA inside the plot; 1 point
 * gets the point + a dotted projection toward the goal. Rendered inside a
 * card-like frame to mirror the real surface (the Log-weight input sits
 * below it in the host).
 */
const meta = {
  title: "Suppr/ProgressWeightEmptyState",
  component: ProgressWeightEmptyState,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
  args: {
    onLogWeight: () => {},
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
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--primary-solid)",
            margin: "0 0 8px",
          }}
        >
          Weight
        </p>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProgressWeightEmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoWeighIns: Story = {
  name: "0 weigh-ins",
  args: { points: [] },
};

export const NoWeighInsWithGoal: Story = {
  name: "0 weigh-ins, goal set",
  args: { points: [], goalKg: 68 },
};

export const OneWeighIn: Story = {
  name: "1 weigh-in",
  args: { points: [{ kg: 72.4 }] },
};

export const OneWeighInWithGoal: Story = {
  name: "1 weigh-in, goal set",
  args: { points: [{ kg: 72.4 }], goalKg: 68 },
};
