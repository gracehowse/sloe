import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TodayDeficitInsight } from "./today-deficit-insight";
import { dateKeyFromDate } from "../../../lib/nutrition/journalNavigation";

/**
 * TodayDeficitInsight — the quiet coach line under the Today ring. Mirrors
 * mobile `apps/mobile/components/today/TodayDeficitInsight.tsx`. Pins the two
 * hour-INDEPENDENT copy branches so Chromatic guards them deterministically
 * (the component reads `new Date().getHours()` only in the ≥4-unlogged-slot
 * cold-open branch, which these fixtures deliberately avoid):
 *
 *   - One slot left → "Room for a snack — about N kcal to play with. No rush."
 *     (Breakfast/Lunch/Dinner logged, only Snacks open.)
 *   - All slots logged → "About N kcal left for today. No rush."
 *
 * `byDay` is keyed via the same `dateKeyFromDate` the component uses, so the
 * logged-slot lookup can't drift from the fixed `selectedDate`.
 */
const FIXED_DATE = new Date("2026-06-21T12:00:00Z");
const DAY_KEY = dateKeyFromDate(FIXED_DATE);

const meta = {
  title: "Suppr/TodayDeficitInsight",
  component: TodayDeficitInsight,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 420, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TodayDeficitInsight>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RoomForSnack: Story = {
  name: "Room for next meal",
  args: {
    remaining: 180,
    selectedDate: FIXED_DATE,
    byDay: {
      [DAY_KEY]: [{ name: "Breakfast" }, { name: "Lunch" }, { name: "Dinner" }],
    },
  },
};

export const AllLogged: Story = {
  name: "All slots logged",
  args: {
    remaining: 240,
    selectedDate: FIXED_DATE,
    byDay: {
      [DAY_KEY]: [
        { name: "Breakfast" },
        { name: "Lunch" },
        { name: "Dinner" },
        { name: "Snacks" },
      ],
    },
  },
};
