import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { UtensilsCrossed } from "lucide-react";
import {
  EmptyMealSlotAimLine,
  PlanAbsentMealSlotRow,
} from "./empty-meal-slot-row";

/**
 * Empty meal-slot UI (ENG-1100) — shared between Today + Plan (web) so aim
 * copy + test IDs can't drift. Two exported renderers; the stories pin each:
 *
 *   - EmptyMealSlotAimLine → "Aim ~X kcal" line, in both Today and Plan tone.
 *   - PlanAbsentMealSlotRow → Plan day-card cell for a canonical slot with no
 *     row yet (aim line when a target exists, "Empty slot" when it doesn't).
 */
const meta = {
  title: "Suppr/EmptyMealSlotRow",
  component: EmptyMealSlotAimLine,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
  args: { slot: "Lunch", aimKcal: 620, surface: "today" },
  decorators: [
    (Story) => (
      <div style={{ width: 320, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EmptyMealSlotAimLine>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TodayAimLine: Story = {
  name: "Aim line (Today)",
  args: { slot: "Lunch", aimKcal: 620, surface: "today" },
};

export const PlanAimLine: Story = {
  name: "Aim line (Plan)",
  args: { slot: "Dinner", aimKcal: 780, surface: "plan" },
};

export const PlanAbsentWithAim: Story = {
  name: "Plan absent slot (with aim)",
  render: () => (
    <PlanAbsentMealSlotRow slot="Breakfast" SlotIcon={UtensilsCrossed} aimKcal={420} />
  ),
};

export const PlanAbsentNoAim: Story = {
  name: "Plan absent slot (empty)",
  render: () => (
    <PlanAbsentMealSlotRow slot="Snacks" SlotIcon={UtensilsCrossed} aimKcal={null} />
  ),
};
