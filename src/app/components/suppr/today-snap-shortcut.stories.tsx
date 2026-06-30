import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TodaySnapShortcut } from "./today-snap-shortcut";

/**
 * TodaySnapShortcut — "Snap a meal" affordance on Today (web), above the macro
 * tiles. Mobile mirror: `apps/mobile/components/today/TodaySnapShortcut.tsx`.
 * Pins the two gate states so Chromatic guards them as a durable regression
 * layer:
 *
 *   - Unlocked → camera tile + "Snap a meal" + speed/AI-estimate subline.
 *   - Locked   → corner lock badge + "PRO" chip beside the title (the gate is
 *     unambiguous before tap; the host still decides PhotoLog vs paywall).
 */
const meta = {
  title: "Suppr/TodaySnapShortcut",
  component: TodaySnapShortcut,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
  args: {
    onPress: () => {},
    locked: false,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TodaySnapShortcut>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unlocked: Story = {
  name: "Unlocked",
  args: { locked: false },
};

export const Locked: Story = {
  name: "Locked (Pro gate)",
  args: { locked: true },
};
