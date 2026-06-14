import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DailyRing } from "./daily-ring";
import { calorieRingGeometryFromSize } from "../../../lib/nutrition/calorieRingGeometry";

/**
 * DailyRing — Today calorie hero ring. These stories pin the four ring states
 * that ENG-1093 reconciled so Chromatic guards them as a durable regression
 * layer:
 *
 *   - Empty + macros HIDDEN  → the ENG-1086 cold-open brand-gradient loop.
 *   - Empty + macros SHOWN    → the populated multi-ring, UNPOPULATED (calorie
 *                               track + 3 grey macro tracks) — Grace 2026-06-13:
 *                               "empty with rings shown should look exactly like
 *                               the populated one, just unpopulated".
 *   - Populated + hidden      → single plum arc.
 *   - Populated + shown       → plum arc + 3 macro arcs.
 *
 * Geometry mirrors the hero wiring in `today-hero-ring.tsx`
 * (`calorieRingGeometryFromSize` + `strokeWidth = expanded ? strokeWidth :
 * strokeWidthBold`) so the story renders at the real proportions. Flags in the
 * `REDESIGN_DEFAULT_ON` set (incl. `ring_empty_macro_parity_v1`) read true in
 * Storybook regardless of PostHog, so these capture the shipped path.
 */
const GEO = calorieRingGeometryFromSize(220);

function Ring({
  consumed,
  expanded,
}: {
  consumed: number;
  expanded: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--card)",
        borderRadius: 24,
        padding: 24,
        display: "inline-flex",
      }}
    >
    <DailyRing
      consumed={consumed}
      target={2000}
      baseGoal={2000}
      size={GEO.size}
      strokeWidth={expanded ? GEO.strokeWidth : GEO.strokeWidthBold}
      ringRadius={GEO.radius}
      macroRadii={GEO.macroRadii}
      macroStroke={GEO.macroStroke}
      proteinPct={consumed > 0 ? 0.62 : 0}
      carbsPct={consumed > 0 ? 0.48 : 0}
      fatPct={consumed > 0 ? 0.35 : 0}
      expanded={expanded}
      onToggle={() => {}}
    />
    </div>
  );
}

const meta = {
  component: DailyRing,
  tags: ["ai-generated"],
  parameters: { layout: "centered" },
} satisfies Meta<typeof DailyRing>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyHidden: Story = {
  name: "Empty · macros hidden (cold-open loop)",
  render: () => <Ring consumed={0} expanded={false} />,
};

export const EmptyShown: Story = {
  name: "Empty · macros shown (unpopulated multi-ring)",
  render: () => <Ring consumed={0} expanded />,
};

export const PopulatedHidden: Story = {
  name: "Populated · macros hidden",
  render: () => <Ring consumed={1280} expanded={false} />,
};

export const PopulatedShown: Story = {
  name: "Populated · macros shown",
  render: () => <Ring consumed={1280} expanded />,
};

/**
 * Side-by-side: the ENG-1093 contract is that "Empty · shown" is the SAME
 * structure as "Populated · shown", just with empty arcs.
 */
export const EmptyVsPopulatedShown: Story = {
  name: "Empty vs Populated (both macros shown)",
  render: () => (
    <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
      <Ring consumed={0} expanded />
      <Ring consumed={1280} expanded />
    </div>
  ),
};
