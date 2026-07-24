import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RedesignRing } from "./RedesignRing";

const meta = {
  title: "Suppr/Redesign/RedesignRing",
  component: RedesignRing,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Refresh-direction calorie ring for the `/redesign/today` prototype: one calm sweep on a whisper track, rounded caps, and a serif remaining-kcal numeral stack in the middle. Presentational only — it takes consumed/goal and derives everything else, so it is safe to render without auth or Supabase.",
      },
    },
  },
  args: { consumed: 1420, goal: 2100 },
} satisfies Meta<typeof RedesignRing>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Mid-day: roughly two-thirds of the sweep drawn. */
export const Default: Story = {};

/** Start of day — an empty sweep, full budget remaining. */
export const DayStart: Story = {
  args: { consumed: 0, goal: 2100 },
};

/** Over goal: the sweep clamps at a full circle and remaining floors at zero. */
export const OverGoal: Story = {
  args: { consumed: 2380, goal: 2100 },
};

/** The compact size used beside the macro legend on narrow viewports. */
export const Compact: Story = {
  args: { consumed: 1420, goal: 2100, size: 148, strokeWidth: 12 },
};
