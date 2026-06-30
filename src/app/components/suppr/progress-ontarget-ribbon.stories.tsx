import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgressOnTargetRibbon } from "./progress-ontarget-ribbon";

/**
 * ProgressOnTargetRibbon — Sloe Figma 492:2 on-target-days ribbon: a calm card
 * with a medal glyph + "N on-target days this week" + supportive subtitle. The
 * count is REAL (host-derived). Mirror:
 * `apps/mobile/components/progress/ProgressOnTargetRibbon.tsx`. Pins the states
 * so Chromatic guards them as a durable regression layer:
 *
 *   - Populated → medal + headline + subtitle (plural / singular paths).
 *   - Zero count → renders nothing (we don't show an empty achievement).
 */
const meta = {
  title: "Suppr/ProgressOnTargetRibbon",
  component: ProgressOnTargetRibbon,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
  args: {
    onTargetCount: 5,
    subtitle: "Your most consistent week this month.",
  },
  decorators: [
    (Story) => (
      <div style={{ width: 380, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProgressOnTargetRibbon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  name: "Populated (5 days)",
  args: { onTargetCount: 5, subtitle: "Your most consistent week this month." },
};

export const SingleDay: Story = {
  name: "Single day (singular copy)",
  args: { onTargetCount: 1, subtitle: "A solid start — keep it going." },
};

export const Zero: Story = {
  name: "Zero (renders nothing)",
  args: { onTargetCount: 0, subtitle: "Your most consistent week this month." },
};
