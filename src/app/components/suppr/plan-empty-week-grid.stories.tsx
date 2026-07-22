import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PlanGhostSlotPill, PlanWeekAimLegend } from "./plan-empty-week-grid";

const meta = {
  title: "Suppr/PlanEmptyWeekGrid",
  component: PlanGhostSlotPill,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Empty-week Plan grid helpers — whisper ghost slot pills and a single aim legend.",
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
} satisfies Meta<typeof PlanGhostSlotPill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GhostSlotPill: Story = {
  name: "Ghost slot pill",
  args: { slot: "Breakfast" },
};

export const WeekAimLegend: Story = {
  name: "Week aim legend",
  args: { slot: "Breakfast" },
  render: () => (
    <PlanWeekAimLegend
      slots={[
        { slot: "Breakfast", aimKcal: 475 },
        { slot: "Lunch", aimKcal: 570 },
        { slot: "Dinner", aimKcal: 665 },
      ]}
    />
  ),
};
