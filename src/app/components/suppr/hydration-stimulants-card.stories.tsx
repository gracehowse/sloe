import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  HydrationStimulantsCard,
  type HydrationStimulantsCardProps,
} from "./hydration-stimulants-card";

/**
 * HydrationStimulantsCard — Water / Caffeine / Alcohol panel (mirrors
 * `apps/mobile/components/HydrationStimulantsCard.tsx`). Presets, over-target
 * copy, and the week-rolling alcohol sum come from the shared pure helper
 * `src/lib/nutrition/hydrationStimulants.ts`. Pins the states so Chromatic +
 * the a11y gate guard them as a durable regression layer:
 *
 *   - empty       → no intake logged; bars empty, no over-target copy.
 *   - partial     → mid-progress water + caffeine, under both targets.
 *   - over-target → caffeine over the daily cap + weekly alcohol over the
 *                   weekly limit → amber bars + factual "Over N" copy (never
 *                   the destructive red).
 *   - imperial    → water rendered in fl oz with the imperial quick-adds.
 *
 * `selectedDateKey` is a fixed key so the Mon–Sun weekly alcohol sum is
 * deterministic. The caffeine + alcohol rows only render when their targets
 * are > 0 (a `caffeineMg`/`alcoholGWeekly` of 0 hides the row).
 */
const FIXED_KEY = "2026-06-24"; // a Wednesday — mid-week so the rolling sum is stable

const baseArgs: HydrationStimulantsCardProps = {
  selectedDateKey: FIXED_KEY,
  weekStartDay: "monday",
  targets: { waterMl: 2000, caffeineMg: 400, alcoholGWeekly: 112 },
  waterTotalMl: 0,
  waterFromMealsMl: 0,
  caffeineTotalMg: 0,
  alcoholByDayG: {},
  measurementSystem: "metric",
  onAddWater: () => {},
  onAddCaffeine: () => {},
  onAddAlcohol: () => {},
  onReset: () => {},
};

const meta = {
  title: "Suppr/HydrationStimulantsCard",
  component: HydrationStimulantsCard,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
  args: baseArgs,
  decorators: [
    (Story) => (
      <div style={{ width: 420, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HydrationStimulantsCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: "Empty (nothing logged)",
  args: { ...baseArgs },
};

export const Partial: Story = {
  name: "Partial (under targets)",
  args: {
    ...baseArgs,
    waterTotalMl: 1100,
    waterFromMealsMl: 300,
    caffeineTotalMg: 180,
    alcoholByDayG: { "2026-06-23": 16 },
  },
};

export const OverTarget: Story = {
  name: "Over target (amber, factual copy)",
  args: {
    ...baseArgs,
    waterTotalMl: 1900,
    caffeineTotalMg: 520, // over the 400 mg daily cap
    alcoholByDayG: {
      "2026-06-22": 48,
      "2026-06-23": 40,
      [FIXED_KEY]: 40, // weekly sum 128 g — over the 112 g weekly limit
    },
  },
};

export const Imperial: Story = {
  name: "Imperial (fl oz)",
  args: {
    ...baseArgs,
    measurementSystem: "imperial",
    waterTotalMl: 1480,
    waterFromMealsMl: 240,
    caffeineTotalMg: 150,
  },
};
