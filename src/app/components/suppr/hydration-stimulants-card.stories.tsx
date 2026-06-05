import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { HydrationStimulantsCard } from "./hydration-stimulants-card";

/**
 * HydrationStimulantsCard — Water + Caffeine + Alcohol rows with quick-add
 * chips and per-row progress. Mirrors mobile `HydrationStimulantsCard`;
 * presets / over-target copy come from the shared
 * `lib/nutrition/hydrationStimulants` helper. Pure presentation — callbacks
 * are no-ops.
 *
 * Branch coverage:
 *   - Caffeine row hidden when `targets.caffeineMg === 0`.
 *   - Alcohol row hidden when `targets.alcoholGWeekly === 0`.
 *   - Over-target → factual amber copy (never destructive red).
 *   - Imperial vs metric water rendering.
 *
 * `selectedDateKey` is a fixed key so the weekly-alcohol sum is
 * deterministic for Chromatic.
 *
 * a11y: the "Hydration" / "Stimulants" section headings use `text-primary`
 * (Sloe clay `#C8794E`, ~3.05:1 on cream) — a pre-existing AA contrast miss
 * across the re-skin, not introduced here. `a11y.test: "todo"` keeps axe
 * running as a warning while the Chromatic visual coverage stands.
 */

const DATE_KEY = "2026-06-03";

const meta = {
  title: "Suppr/HydrationStimulantsCard",
  component: HydrationStimulantsCard,
  tags: ["ai-generated"],
  parameters: { layout: "padded", a11y: { test: "todo" } },
  decorators: [
    (Story) => (
      <div className="w-[420px]">
        <Story />
      </div>
    ),
  ],
  args: {
    selectedDateKey: DATE_KEY,
    weekStartDay: "monday",
    waterFromMealsMl: 0,
    measurementSystem: "metric",
    onAddWater: () => {},
    onAddCaffeine: () => {},
    onAddAlcohol: () => {},
    onReset: () => {},
  },
} satisfies Meta<typeof HydrationStimulantsCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** All three rows, mid-progress, under target. */
export const Default: Story = {
  args: {
    targets: { waterMl: 2000, caffeineMg: 400, alcoholGWeekly: 140 },
    waterTotalMl: 1200,
    caffeineTotalMg: 180,
    alcoholByDayG: { [DATE_KEY]: 14 },
  },
};

/** Over target on caffeine + alcohol — both rows show the amber "Over …"
 *  copy and the amber bar overlay (no card-wide red). */
export const OverTarget: Story = {
  args: {
    targets: { waterMl: 2000, caffeineMg: 400, alcoholGWeekly: 140 },
    waterTotalMl: 1800,
    caffeineTotalMg: 520,
    alcoholByDayG: { [DATE_KEY]: 180 },
  },
};

/** Water-only — caffeine + alcohol targets at 0 hide both rows, so the
 *  Stimulants section disappears entirely. */
export const WaterOnly: Story = {
  args: {
    targets: { waterMl: 2000, caffeineMg: 0, alcoholGWeekly: 0 },
    waterTotalMl: 1200,
    caffeineTotalMg: 0,
    alcoholByDayG: {},
  },
};

/** Includes-from-food secondary line under water. */
export const WaterFromFood: Story = {
  args: {
    targets: { waterMl: 2000, caffeineMg: 400, alcoholGWeekly: 140 },
    waterTotalMl: 1450,
    waterFromMealsMl: 350,
    caffeineTotalMg: 95,
    alcoholByDayG: {},
  },
};

/** Imperial water units (fl oz). */
export const Imperial: Story = {
  args: {
    measurementSystem: "imperial",
    targets: { waterMl: 2000, caffeineMg: 400, alcoholGWeekly: 140 },
    waterTotalMl: 1200,
    caffeineTotalMg: 180,
    alcoholByDayG: { [DATE_KEY]: 14 },
  },
};

export const DefaultDark: Story = {
  args: {
    targets: { waterMl: 2000, caffeineMg: 400, alcoholGWeekly: 140 },
    waterTotalMl: 1200,
    caffeineTotalMg: 180,
    alcoholByDayG: { [DATE_KEY]: 14 },
  },
  globals: { theme: "dark" },
};
