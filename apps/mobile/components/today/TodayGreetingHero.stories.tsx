import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { TodayGreetingHero } from "./TodayGreetingHero";

const meta = {
  title: "Mobile/Today/TodayGreetingHero",
  component: TodayGreetingHero,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider>
        <div style={{ width: 360, padding: 16, background: "#F7F6FA" }}>
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The Today hero: the TODAY eyebrow over a single serif line merging day name and date. This is where the canonical eyebrow came from — ink caps at 11/600/0.12em followed by a faint `border` hairline running to the margin — now promoted to `Type.eyebrow` and shared with `ScreenSectionChrome`, so the app carries one eyebrow rather than two copies of the same spec. The rule is deliberately the faint border token, never mid-grey `textTertiary`, which read as a hard grey line. The eyebrow shows only for today; historic days keep the headline/subline split and no eyebrow.",
      },
    },
  },
  args: { viewMode: "day", isToday: true, selectedDate: new Date("2026-06-21T12:00:00") },
} satisfies Meta<typeof TodayGreetingHero>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Today: eyebrow + rule, then one serif line ("Sunday 21 June"). */
export const TodayDayView: Story = {};

/** A historic day — no eyebrow, and the greeting keeps its headline/subline split. */
export const PastDay: Story = { args: { isToday: false, selectedDate: new Date("2026-06-15T12:00:00") } };

/** A long day/date pair — the serif line truncates to one line rather than wrapping. */
export const LongDateLine: Story = {
  args: { selectedDate: new Date("2026-09-30T12:00:00") },
};
