import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgressAverageAdherence } from "./progress-average-adherence";

/**
 * ProgressAverageAdherence — Sloe Figma 492:2 "AVERAGE ADHERENCE" card:
 * headline % + on-target streak dots + four macro bars (Protein/Carbs/Fat/
 * Fibre). Mirror: `apps/mobile/components/progress/ProgressAverageAdherence.tsx`.
 * Over-target macro bars are AMBER (warning), never red — the red over rule is
 * the calorie-RING carve-out only. Pins the states so Chromatic guards them as
 * a durable regression layer:
 *
 *   - Populated → headline + dots + four macro bars (one over → amber).
 *   - Over headline (> 110%) → amber overshoot reading instead of raw "%".
 *   - Null adherence → renders nothing (no card without a real number).
 */
const MACROS = [
  { name: "Protein" as const, pct: 96, color: "var(--macro-protein)" },
  { name: "Carbs" as const, pct: 88, color: "var(--macro-carbs)" },
  { name: "Fat" as const, pct: 112, color: "var(--macro-fat)" },
  { name: "Fibre" as const, pct: 74, color: "var(--macro-fiber)" },
];

const meta = {
  title: "Suppr/ProgressAverageAdherence",
  component: ProgressAverageAdherence,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
  args: {
    adherencePct: 94,
    onTargetDays: [true, true, false, true, true, true, false],
    macros: MACROS,
    adherenceDeltaPct: 5,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 380, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProgressAverageAdherence>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  name: "Populated (one macro over → amber)",
  args: {
    adherencePct: 94,
    onTargetDays: [true, true, false, true, true, true, false],
    macros: MACROS,
    adherenceDeltaPct: 5,
  },
};

export const OverHeadline: Story = {
  name: "Over headline (amber overshoot)",
  args: {
    adherencePct: 118,
    onTargetDays: [false, true, false, false, true, false, false],
    macros: MACROS,
    adherenceDeltaPct: null,
  },
};

export const NoData: Story = {
  name: "Null adherence (renders nothing)",
  args: {
    adherencePct: null,
    onTargetDays: [false, false, false, false, false, false, false],
    macros: MACROS,
  },
};
