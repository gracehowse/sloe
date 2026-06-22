import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgressWeightEmptyState } from "./progress-weight-empty-state";

/**
 * ProgressWeightEmptyState — new-user "No weigh-ins yet" prompt for the Progress
 * weight card (ENG-1225 #22). Rendered inside a card-like frame to mirror the
 * real surface (the Log-weight input sits below it in the host).
 */
const meta = {
  title: "Suppr/ProgressWeightEmptyState",
  component: ProgressWeightEmptyState,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
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

export const Default: Story = { name: "No weigh-ins yet" };
