import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { dateKeyFromDate } from "../../lib/datetime/dateKey";
import { DayStrip } from "./DayStrip";

const todayKey = dateKeyFromDate(new Date());

function buildLoggedDays(offsets: number[]): ReadonlySet<string> {
  const base = new Date();
  return new Set(
    offsets.map((offset) => {
      const d = new Date(base);
      d.setDate(d.getDate() + offset);
      return dateKeyFromDate(d);
    }),
  );
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
          "Horizontal week pager for journal date selection — chevrons, calendar jump, logged-day dots.",
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
