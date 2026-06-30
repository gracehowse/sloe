import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgressPeriodControl } from "./progress-period-control";
import type { ProgressPeriod } from "../../../lib/nutrition/progressPeriod";

/**
 * ProgressPeriodControl — Apple Health range grammar (ENG-1030): D / W / M /
 * 6M / Y segmented control + a ‹ label › paging row. Mirror:
 * `apps/mobile/components/progress/ProgressPeriodControl.tsx`. `now` is injected
 * for deterministic labels (the component otherwise reads the real clock), so
 * these Chromatic snapshots can't drift day-to-day. Pins each segment + the
 * paging edge so Chromatic guards them as a durable regression layer:
 *
 *   - Week (current) → "W" selected, forward chevron disabled (no future).
 *   - Day / Month / 6M / Year → each segment selected with its label grammar.
 *   - Past period → forward chevron enabled (can page back toward now).
 */
const NOW = new Date("2026-06-21T12:00:00Z");
const week = (offset: number): ProgressPeriod => ({ type: "W", offset });

const meta = {
  title: "Suppr/ProgressPeriodControl",
  component: ProgressPeriodControl,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
  args: {
    period: week(0),
    weekStart: "monday",
    onChange: () => {},
    now: NOW,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 380, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProgressPeriodControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CurrentWeek: Story = {
  name: "Week (current — forward disabled)",
  args: { period: week(0) },
};

export const Day: Story = {
  name: "Day",
  args: { period: { type: "D", offset: 0 } },
};

export const Month: Story = {
  name: "Month",
  args: { period: { type: "M", offset: 0 } },
};

export const SixMonths: Story = {
  name: "Six months",
  args: { period: { type: "6M", offset: 0 } },
};

export const Year: Story = {
  name: "Year",
  args: { period: { type: "Y", offset: 0 } },
};

export const PastWeek: Story = {
  name: "Past week (forward enabled)",
  args: { period: week(-1) },
};
