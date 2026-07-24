import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import DayStrip from "./DayStrip";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { Colors } from "@/constants/theme";

/** The strip derives "today" and its navigable range from the real clock, so
 *  story fixtures are expressed as offsets from today rather than fixed dates —
 *  a hard-coded date would drift out of the journal range and stop exercising
 *  the today / future states the flag introduced. */
function dayOffset(offset: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}

function keyOffset(offset: number): string {
  const d = dayOffset(offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const meta = {
  title: "Mobile/Charts/DayStrip",
  component: DayStrip,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Today's week pager. Under `design_consistency_v1` each channel carries one meaning: the RING says selected (1px plum outline, never a fill — the rounded-outline idiom PlanWeekStripV3 already uses, with the border slot always occupied so selecting cannot shift layout), the NUMBER tone says temporal state, and the DOT says has-data (sage) with a faint `border` placeholder holding the slot. `tertiaryColor` supplies the muted tone for day letters and future numbers; omit it and the component falls back to the theme's own `textTertiary` rather than silently downgrading to secondary. Flag off restores the 2026-06-24 filled-cell treatment verbatim. Web twin: src/app/components/DayStrip.tsx.",
      },
    },
  },
  args: {
    selectedDate: dayOffset(0),
    weekStartDay: "monday" as const,
    loggedDays: new Set([keyOffset(-3), keyOffset(-2), keyOffset(-1)]),
    onSelectDate: () => undefined,
    onOpenCalendar: () => undefined,
    textColor: Colors.light.text,
    secondaryColor: Colors.light.textSecondary,
    tertiaryColor: Colors.light.textTertiary,
  },
} satisfies Meta<typeof DayStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Today selected — ring on today, sage dots behind the logged run. */
export const Default: Story = {};

/** Freeze glyph on a protected day, announced to VoiceOver as "Freeze used". */
export const WithFreezes: Story = {
  args: { protectedDateKeys: new Set([keyOffset(-2)]) },
};

/** Selection off today: the ring travels, today keeps its accent number. The
 *  case the old full-fill cell collapsed into one indistinguishable state. */
export const PastDaySelected: Story = {
  args: { selectedDate: dayOffset(-2) },
};

/** A future day selected — number steps to the tertiary "not yet" tint, cell
 *  opacity stays full because future days are navigable, not disabled. */
export const FutureDaySelected: Story = {
  args: { selectedDate: dayOffset(2) },
};

/** Nothing logged — every dot slot holds the faint hairline placeholder, so the
 *  row height never jumps as data arrives. */
export const NoLoggedDays: Story = {
  args: { loggedDays: new Set<string>() },
};

/** `tertiaryColor` omitted — the host (week-mode strip) doesn't pass it, and the
 *  component falls back to the theme's `textTertiary` rather than to secondary. */
export const TertiaryColorFallback: Story = {
  args: { tertiaryColor: undefined },
};

/** Sunday-start weeks, the alternate calendar preference. */
export const SundayWeekStart: Story = {
  args: { weekStartDay: "sunday" as const },
};
