import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TodayFastingPill } from "./today-fasting-pill";

/**
 * TodayFastingPill — fasting-state CTA on Today (web parity with mobile
 * `TodayFastingPill`). Pins the three render modes so Chromatic guards them
 * as a durable regression layer:
 *
 *   - Active fast → prominent "Fasting — Xh Ym" pill (links to /fasting).
 *   - Idle (opted in, no active fast) → outline "Start fast" pill.
 *   - Not opted in → renders nothing (non-IF users see no affordance).
 */
const meta = {
  title: "Suppr/TodayFastingPill",
  component: TodayFastingPill,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
  args: {
    activeFastElapsedLabel: "14h 22m",
    fastingOptedIn: true,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TodayFastingPill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ActiveFast: Story = {
  name: "Active fast",
  args: { activeFastElapsedLabel: "14h 22m", fastingOptedIn: true },
};

export const Idle: Story = {
  name: "Idle (Start fast)",
  args: { activeFastElapsedLabel: null, fastingOptedIn: true },
};

export const NotOptedIn: Story = {
  name: "Not opted in (renders nothing)",
  args: { activeFastElapsedLabel: null, fastingOptedIn: false },
};
