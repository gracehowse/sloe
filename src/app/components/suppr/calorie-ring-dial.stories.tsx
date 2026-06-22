import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CalorieRingDial } from "./calorie-ring-dial";

/**
 * CalorieRingDial — Sloe v3 jewel watch-dial calorie ring. Pins the three
 * states so Chromatic guards them as a durable regression layer:
 *
 *   - Empty (0 eaten)      → frost dial, single leading gem.
 *   - Under budget         → sage gradient-lit segments fill to progress.
 *   - Over budget          → destructive→warm segments full circle, warning numeral.
 */
function Dial({ consumed, target }: { consumed: number; target: number }) {
  return (
    <div
      style={{
        background: "var(--bg)",
        borderRadius: 24,
        padding: 16,
        display: "inline-flex",
      }}
    >
      <CalorieRingDial consumed={consumed} target={target} size={220} />
    </div>
  );
}

const meta = {
  title: "Suppr/CalorieRingDial",
  component: CalorieRingDial,
  tags: ["ai-generated"],
  parameters: { layout: "centered" },
  args: { consumed: 0, target: 2000 },
} satisfies Meta<typeof CalorieRingDial>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: "Empty (fresh day)",
  render: () => <Dial consumed={0} target={2000} />,
};

export const Under: Story = {
  name: "Under budget (sage)",
  render: () => <Dial consumed={1200} target={2000} />,
};

export const Over: Story = {
  name: "Over budget (destructive→warm)",
  render: () => <Dial consumed={2300} target={2000} />,
};

/** All three states side-by-side. */
export const AllStates: Story = {
  name: "All states",
  render: () => (
    <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
      <Dial consumed={0} target={2000} />
      <Dial consumed={1200} target={2000} />
      <Dial consumed={2300} target={2000} />
    </div>
  ),
};
