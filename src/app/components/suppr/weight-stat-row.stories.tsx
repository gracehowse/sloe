import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WeightStatRow } from "./weight-stat-row";

/**
 * WeightStatRow — START / CURRENT / GOAL / RATE four-up under the Progress
 * weight chart (ENG-1225 #22). Values are pre-formatted by the caller ("—"
 * when absent). Pins the populated + new-user states so Chromatic guards them
 * as a durable regression layer:
 *
 *   - Populated → all four stats filled (losing-weight rate path).
 *   - New user → every cell shows "—" (no weigh-ins logged yet).
 */
const meta = {
  title: "Suppr/WeightStatRow",
  component: WeightStatRow,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
  args: {
    start: "82.4 kg",
    current: "79.1 kg",
    goal: "75.0 kg",
    rate: "-0.4 kg/wk",
  },
  decorators: [
    (Story) => (
      <div style={{ width: 360, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WeightStatRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  name: "Populated",
  args: {
    start: "82.4 kg",
    current: "79.1 kg",
    goal: "75.0 kg",
    rate: "-0.4 kg/wk",
  },
};

export const NewUser: Story = {
  name: "New user (no weigh-ins)",
  args: { start: "—", current: "—", goal: "75.0 kg", rate: "—" },
};
