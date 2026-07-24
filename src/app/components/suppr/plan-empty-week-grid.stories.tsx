import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  PlanGhostSlotPill,
  PlanGhostWeekGrid,
  PlanWeekAimLegend,
} from "./plan-empty-week-grid";

const WEEK_DATES = Array.from({ length: 7 }, (_, i) => new Date(2026, 6, 20 + i));

const meta = {
  title: "Suppr/PlanEmptyWeekGrid",
  component: PlanGhostSlotPill,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Plan empty-week ghost pieces. `PlanGhostSlotPill` + `PlanWeekAimLegend` serve the legacy kanban (ENG-1372): an empty cell collapses to a whisper pill, and the 'Aim ~475/570/665' guidance is stated once above the grid instead of seven times inside it. `PlanGhostWeekGrid` serves the v3 surfaces — it draws the shape of what 'Generate this week' produces, so the desktop empty Plan is no longer a top-anchored card over ~700px of void. Deliberately non-interactive, and it speaks to assistive tech once as a single `role=\"img\"` sentence rather than 28 announced pills. Mobile twin: apps/mobile/components/plan/PlanGhostWeekGrid.tsx.",
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

/** The ghosted week at phone width — a row per day, which is what mobile renders. */
export const GhostWeekGridNarrow: Story = {
  name: "Ghost week grid — narrow",
  args: { slot: "Breakfast" },
  render: () => (
    <PlanGhostWeekGrid weekDates={WEEK_DATES} slots={["Breakfast", "Lunch", "Dinner"]} />
  ),
};

/** The same grid at `lg`, where it becomes a true seven-column week and fills
 *  the desktop void the empty-week card used to float in. */
export const GhostWeekGridDesktop: Story = {
  name: "Ghost week grid — desktop",
  args: { slot: "Breakfast" },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 1120, background: "var(--bg)", padding: 24 }}>
        <Story />
      </div>
    ),
  ],
  render: () => (
    <PlanGhostWeekGrid weekDates={WEEK_DATES} slots={["Breakfast", "Lunch", "Dinner"]} />
  ),
};

/** Four slots (Snacks enabled) — the pill count comes from the plan's own slot
 *  list, never a hard-coded three. */
export const GhostWeekGridFourSlots: Story = {
  name: "Ghost week grid — four slots",
  args: { slot: "Breakfast" },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 1120, background: "var(--bg)", padding: 24 }}>
        <Story />
      </div>
    ),
  ],
  render: () => (
    <PlanGhostWeekGrid
      weekDates={WEEK_DATES}
      slots={["Breakfast", "Lunch", "Dinner", "Snacks"]}
    />
  ),
};
