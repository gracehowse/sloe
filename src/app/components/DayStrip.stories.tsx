import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { dateKeyFromDate } from "../../lib/datetime/dateKey";
import { DayStrip } from "./DayStrip";

function keyOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return dateKeyFromDate(d);
}

const todayKey = keyOffset(0);

function buildLoggedDays(offsets: number[]): ReadonlySet<string> {
  return new Set(offsets.map(keyOffset));
}

const meta = {
  title: "Host/DayStrip",
  component: DayStrip,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Horizontal week pager for journal date selection — chevrons, calendar jump, day cells. Under `design_consistency_v1` each visual channel carries exactly one meaning: the RING says selected (a 1px plum outline, never a fill — the same idiom PlanWeekStripV3 uses), the NUMBER tone says which day this is in time (selected ink / today accent / future tint / default), and the DOT says has-data (sage) with a faint border-tone placeholder holding the slot otherwise. Future days tint their number rather than fading the cell — they are navigable, so a fade would read as disabled. Flag off restores the 2026-06-24 plum-filled cell verbatim. Mobile twin: apps/mobile/components/charts/DayStrip.tsx.",
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
  args: {
    selectedDateKey: todayKey,
    weekStartDay: "monday",
    loggedDays: buildLoggedDays([-2, -1, 0]),
    onSelectDateKey: () => undefined,
    onOpenCalendar: () => undefined,
  },
} satisfies Meta<typeof DayStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Today selected: ring + ink number + sage dot, with the rest of the week
 *  showing past-logged dots and future-tinted numbers. */
export const Default: Story = {};

export const SundayWeekStart: Story = {
  name: "Sunday week start",
  args: {
    weekStartDay: "sunday",
  },
};

export const WithStreakFreeze: Story = {
  name: "Streak freeze glyph",
  args: {
    protectedDateKeys: new Set([todayKey]),
  },
};

/**
 * Selection moved off today — the ring travels to the chosen past day while
 * today keeps its accent number. This is the case the old filled-cell
 * treatment collapsed: selection and today became indistinguishable.
 */
export const PastDaySelected: Story = {
  name: "Past day selected",
  args: {
    selectedDateKey: keyOffset(-2),
  },
};

/**
 * A future day selected. The number steps to the tertiary tint ("not yet"),
 * the cell keeps full opacity, and the ring still marks selection.
 */
export const FutureDaySelected: Story = {
  name: "Future day selected",
  args: {
    selectedDateKey: keyOffset(2),
  },
};

/**
 * Nothing logged all week — every dot slot holds the faint hairline
 * placeholder, so the row keeps its height instead of jumping as data arrives.
 */
export const NoLoggedDays: Story = {
  name: "No logged days",
  args: {
    loggedDays: new Set<string>(),
  },
};

/** A fully logged week — seven sage dots, the streak read at a glance. */
export const FullyLoggedWeek: Story = {
  name: "Fully logged week",
  args: {
    loggedDays: buildLoggedDays([-6, -5, -4, -3, -2, -1, 0]),
  },
};
