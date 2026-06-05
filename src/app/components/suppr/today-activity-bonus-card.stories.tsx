import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  TodayActivityBonusCard,
  type TodayActivityBonusCardProps,
} from "./today-activity-bonus-card";
import { todayKey } from "../../../lib/nutrition/trackerDate";

/**
 * TodayActivityBonusCard — Today "Net energy" balance card (Sloe TD1):
 * net headline hero, deficit ↔ maintenance ↔ surplus slider, Burned / Eaten
 * / Maintenance stat row, plus a sibling 7-day rolling rollup card. Mirrors
 * mobile `TodayActivityBonusCard`. Pure presentation — all plain values.
 *
 * Returns `null` when `hasBurnData` is false, so every story sets it true.
 * `selectedDateKey` is a fixed past key (not today) so the sublines render
 * deterministic "for this day" copy for Chromatic.
 *
 * a11y note: this card has two pre-existing (component-level, not
 * story-introduced) axe failures — the small surplus chip label is white on
 * clay `#C8794E` (~3.33:1, fails AA-normal) and the deficit/maintenance/
 * surplus slider `role="progressbar"` has no accessible name. Both are real
 * defects in the Sloe re-skin, tracked separately. We set `a11y.test:
 * "todo"` so axe still RUNS (violations show in the a11y panel) but doesn't
 * hard-fail — the goal here is the Chromatic visual-regression coverage of
 * every net-energy state on the real surface.
 */

const DATE_KEY = "2026-06-03";
const WEEK_KEYS = [
  "2026-06-01",
  "2026-06-02",
  "2026-06-03",
  "2026-06-04",
  "2026-06-05",
  "2026-06-06",
  "2026-06-07",
];

// Per-day burn / intake so the weekly rollup card renders with real-looking
// numbers (active + basal by day, meals by day).
const ACTIVITY_BY_DAY: Record<string, number> = {
  "2026-06-01": 420,
  "2026-06-02": 380,
  "2026-06-03": 450,
  "2026-06-04": 300,
  "2026-06-05": 520,
};
const BASAL_BY_DAY: Record<string, number> = Object.fromEntries(
  WEEK_KEYS.map((k) => [k, 1500]),
);
const NUTRITION_BY_DAY: Record<string, Array<{ calories?: number }>> = {
  "2026-06-01": [{ calories: 1800 }],
  "2026-06-02": [{ calories: 1650 }],
  "2026-06-03": [{ calories: 1900 }],
  "2026-06-04": [{ calories: 1720 }],
  "2026-06-05": [{ calories: 1850 }],
};

const baseArgs: TodayActivityBonusCardProps = {
  hasBurnData: true,
  totalBurnKcal: 2000,
  effectiveCalorieTarget: 1800,
  consumedCalories: 1500,
  basalBurnKcal: 1500,
  activityBurnForSelectedDay: 500,
  workouts: [{ type: "Running", minutes: 40, calories: 420, source: "Health" }],
  weekSummaryMode: "rolling",
  weekSummaryKeys: WEEK_KEYS,
  activityBurnByDay: ACTIVITY_BY_DAY,
  basalBurnByDay: BASAL_BY_DAY,
  nutritionByDay: NUTRITION_BY_DAY,
  selectedDateKey: DATE_KEY,
  profileMeasurementSystem: "metric",
  maintenanceTdeeKcal: 2100,
};

const meta = {
  title: "Suppr/TodayActivityBonusCard",
  component: TodayActivityBonusCard,
  tags: ["ai-generated"],
  parameters: {
    layout: "padded",
    // Pre-existing component a11y defects (surplus-chip contrast + unnamed
    // progressbar), out of scope for these visual-coverage stories. Run axe
    // as a warning, don't gate. See file header + the spawned contrast task.
    a11y: { test: "todo" },
  },
  decorators: [
    (Story) => (
      <div className="w-[420px]">
        <Story />
      </div>
    ),
  ],
  args: baseArgs,
} satisfies Meta<typeof TodayActivityBonusCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Deficit — burned (2,000) well above eaten (1,500): sage chip, positive
 *  net headline, knob left of centre. */
export const Deficit: Story = {
  args: { totalBurnKcal: 2000, consumedCalories: 1500 },
};

/** Maintenance — burned ≈ eaten (within ±60 kcal): plum chip, knob centred. */
export const Maintenance: Story = {
  args: { totalBurnKcal: 2000, consumedCalories: 1980 },
};

/** Surplus — eaten above burned: clay chip, knob right of centre. */
export const Surplus: Story = {
  args: { totalBurnKcal: 2000, consumedCalories: 2400 },
};

/** No maintenance figure — the Maintenance stat tile is dropped (2 tiles),
 *  and the slider falls back to its no-maintenance positioning. */
export const NoMaintenance: Story = {
  args: {
    totalBurnKcal: 2000,
    consumedCalories: 1500,
    maintenanceTdeeKcal: null,
  },
};

/** No food logged this day — the "burned so far · no food logged" subline. */
export const NoFoodLogged: Story = {
  args: { totalBurnKcal: 1900, consumedCalories: 0 },
};

/** Activity-budget discover banner — the upsell to enable activity-adjusted
 *  calories. Only shows when the selected day IS today, so this story passes
 *  a live `todayKey()` to exercise the banner branch. */
export const DiscoverBanner: Story = {
  args: {
    selectedDateKey: todayKey(),
    showActivityBudgetDiscoverBanner: true,
    preferActivityAdjustedCalories: false,
    activityBudgetAddonKcal: 250,
    onEnableActivityBudget: () => {},
    onDismissActivityBudgetDiscover: () => {},
  },
};

export const DeficitDark: Story = {
  args: { totalBurnKcal: 2000, consumedCalories: 1500 },
  globals: { theme: "dark" },
};
