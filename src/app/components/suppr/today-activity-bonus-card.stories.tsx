import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  TodayActivityBonusCard,
  type TodayActivityBonusCardProps,
} from "./today-activity-bonus-card";

/**
 * TodayActivityBonusCard — Today energy-balance hero + 7-day rolling sibling
 * card (Figma TD1). Pins the states so Chromatic guards them as a durable
 * regression layer:
 *
 *   - Deficit  → sage headline + chip (burned > eaten by >60 kcal).
 *   - Surplus  → clay/plum headline + chip (eaten > burned by >60 kcal).
 *   - With maintenance → adds the Maintenance stat tile + the TDEE-explainer
 *     info popover trigger.
 *   - With workouts → renders the per-workout rows.
 *   - Weekly rolling → the sibling 7-day rollup card (avg / weekly / projected).
 *
 * The card returns `null` unless `hasBurnData` is true, so every story sets it.
 * `selectedDateKey` is a non-today fixed key so the "for this day" copy path is
 * deterministic (today vs not changes a few labels). Mobile parity:
 * `apps/mobile/components/today/TodayActivityBonusCard.tsx`.
 */
const FIXED_KEY = "2026-06-21";

const baseArgs: TodayActivityBonusCardProps = {
  hasBurnData: true,
  totalBurnKcal: 2380,
  effectiveCalorieTarget: 2000,
  consumedCalories: 1840,
  basalBurnKcal: 1620,
  activityBurnForSelectedDay: 760,
  workouts: [],
  weekSummaryMode: "rolling",
  weekSummaryKeys: [],
  activityBurnByDay: {},
  basalBurnByDay: {},
  nutritionByDay: {},
  selectedDateKey: FIXED_KEY,
  profileMeasurementSystem: "metric",
  maintenanceTdeeKcal: null,
};

const meta = {
  title: "Suppr/TodayActivityBonusCard",
  component: TodayActivityBonusCard,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
  args: baseArgs,
  decorators: [
    (Story) => (
      <div style={{ width: 440, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TodayActivityBonusCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Deficit: Story = {
  name: "Deficit (sage)",
  args: {
    ...baseArgs,
    totalBurnKcal: 2380,
    consumedCalories: 1840, // net +540 → deficit
  },
};

export const Surplus: Story = {
  name: "Surplus (clay)",
  args: {
    ...baseArgs,
    totalBurnKcal: 2100,
    consumedCalories: 2620, // net -520 → surplus
  },
};

export const WithMaintenance: Story = {
  name: "With maintenance tile + info",
  args: {
    ...baseArgs,
    maintenanceTdeeKcal: 2240,
    maintenanceSource: "adaptive",
    maintenanceConfidence: "high",
    profileSex: "female",
    profileWeightKg: 68,
    profileHeightCm: 168,
    profileAge: 32,
    profileActivityLevel: "moderate",
  },
};

export const WithWorkouts: Story = {
  name: "With workouts",
  args: {
    ...baseArgs,
    totalBurnKcal: 2640,
    activityBurnForSelectedDay: 1020,
    workouts: [
      { type: "Running", minutes: 42, calories: 480, source: "Apple Health" },
      { type: "Strength", minutes: 35, calories: 260, source: "Apple Health" },
    ],
  },
};

export const WeeklyRolling: Story = {
  name: "With weekly rolling card",
  args: {
    ...baseArgs,
    weekSummaryKeys: [
      "2026-06-15",
      "2026-06-16",
      "2026-06-17",
      "2026-06-18",
      "2026-06-19",
      "2026-06-20",
      FIXED_KEY,
    ],
    activityBurnByDay: {
      "2026-06-15": 620,
      "2026-06-16": 540,
      "2026-06-17": 880,
      "2026-06-18": 410,
      "2026-06-19": 720,
      "2026-06-20": 360,
      [FIXED_KEY]: 760,
    },
    basalBurnByDay: {
      "2026-06-15": 1620,
      "2026-06-16": 1620,
      "2026-06-17": 1620,
      "2026-06-18": 1620,
      "2026-06-19": 1620,
      "2026-06-20": 1620,
      [FIXED_KEY]: 1620,
    },
    nutritionByDay: {
      "2026-06-15": [{ calories: 1840 }],
      "2026-06-16": [{ calories: 1920 }],
      "2026-06-17": [{ calories: 2010 }],
      "2026-06-18": [{ calories: 1760 }],
      "2026-06-19": [{ calories: 1880 }],
      "2026-06-20": [{ calories: 1950 }],
      [FIXED_KEY]: [{ calories: 1840 }],
    },
  },
};
