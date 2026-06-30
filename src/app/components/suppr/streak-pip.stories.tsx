import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StreakPip } from "./streak-pip";

/**
 * StreakPip — restrained streak pill shown next to the Today date row. Web
 * parity to `apps/mobile/components/today/StreakPip.tsx`. Pins the tone +
 * size variants so Chromatic guards them as a durable regression layer:
 *
 *   - Zero (< 2) → muted neutral "Start your streak".
 *   - Active (≥ 2) → primary tone "N-day streak".
 *   - Milestone (7/14/21/30/…) → warning-soft milestone tone.
 *   - Freeze-protected → Shield glyph + calm slate ("a freeze covered you").
 *   - Large → 28pt headline placement (above the weekly recap card).
 *   - Tappable → renders as a button (opens the weekly recap).
 */
const meta = {
  title: "Suppr/StreakPip",
  component: StreakPip,
  tags: ["ai-generated"],
  parameters: { layout: "centered" },
  args: { days: 5 },
  decorators: [
    (Story) => (
      <div style={{ background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StreakPip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {
  name: "Active (primary)",
  args: { days: 5 },
};

export const Zero: Story = {
  name: "Zero (start your streak)",
  args: { days: 0 },
};

export const Milestone: Story = {
  name: "Milestone (1 week)",
  args: { days: 7 },
};

export const FreezeProtected: Story = {
  name: "Freeze protected",
  args: { days: 12, freezeProtected: true },
};

export const Large: Story = {
  name: "Large (headline placement)",
  args: { days: 30, size: "lg" },
};

export const Tappable: Story = {
  name: "Tappable (button)",
  args: { days: 9, onPress: () => {} },
};
