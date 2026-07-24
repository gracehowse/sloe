import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RedesignMacroStat } from "./RedesignMacroStat";

const meta = {
  title: "Suppr/Redesign/RedesignMacroStat",
  component: RedesignMacroStat,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A single macro readout for the `/redesign/today` prototype — serif value as the loud layer, uppercase eyebrow label, and a slim rail tinted in the macro's own hue. `variant=\"tile\"` adds the card slab plus an 'N left' foot; `variant=\"compact\"` is the chromeless form used in the hero legend beside the ring.",
      },
    },
  },
  args: {
    label: "Protein",
    value: 96,
    goal: 140,
    color: "var(--macro-protein)",
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 220 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RedesignMacroStat>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The grid tile — card slab, rail, and the remaining-grams foot. */
export const Tile: Story = {};

/** Chromeless form for the hero legend: no slab, no 'left' foot. */
export const Compact: Story = {
  args: { variant: "compact" },
};

/** Goal met — the rail clamps full and nothing is left to eat. */
export const GoalMet: Story = {
  args: { label: "Carbs", value: 210, goal: 210, color: "var(--macro-carbs)" },
};

/** All three macros side by side, the way the grid actually reads. */
export const MacroRow: Story = {
  decorators: [
    (Story) => (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, maxWidth: 560 }}>
        <Story />
        <RedesignMacroStat label="Carbs" value={150} goal={210} color="var(--macro-carbs)" />
        <RedesignMacroStat label="Fat" value={48} goal={70} color="var(--macro-fat)" />
      </div>
    ),
  ],
};
