// @vitest-environment jsdom
/**
 * Mobile `HydrationStimulantsCard` — parity render test (post-ship #3,
 * 2026-04-18). Mirrors the shape of the shared
 * `src/lib/nutrition/hydrationStimulants.ts` constants into the rendered
 * UI so a silent drift in either direction (chip relabel, helper-return
 * change, display-unit flip) fails CI on both platforms.
 *
 * The web counterpart lives at `tests/unit/hydrationStimulants.test.ts`
 * (helper-level) — the mobile card had no render coverage before RNTL
 * landed. This file is the infrastructure claim: `@testing-library/
 * react-native` IS wired, and it really renders the component — not a
 * source-grep substitute.
 *
 * Coverage:
 *   1. Metric chip labels match the canonical `WATER_QUICK_ADDS_ML`
 *      tuple (`100 ml / 250 ml / 500 ml / 750 ml`).
 *   2. Imperial chip labels match `imperialWaterQuickAdds()`
 *      (`4 fl oz / 8 fl oz / 16 fl oz / 20 fl oz`).
 *   3. Progress row renders water totals in the correct unit per
 *      `formatWaterAmount(ml, system)` — ml on metric, fl oz on imperial.
 *   4. Tapping a chip invokes `onAddWater(ml)` with the `ml` value the
 *      helper stored — storage stays metric even when the display is
 *      imperial (the C3 audit invariant).
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

import { HydrationStimulantsCard } from "../../components/HydrationStimulantsCard";
import {
  WATER_QUICK_ADDS_ML,
  imperialWaterQuickAdds,
} from "@suppr/nutrition-core/hydrationStimulants";

// Ensure React is not tree-shaken.
void React;

const BASE_TARGETS = {
  waterMl: 2000,
  caffeineMg: 400,
  alcoholGWeekly: 0, // row hidden — keeps the snapshot narrow
};

describe("HydrationStimulantsCard (mobile) — water chip parity", () => {
  it("renders the four metric chip labels from WATER_QUICK_ADDS_ML", () => {
    const onAddWater = vi.fn();
    const { getByLabelText } = render(
      <HydrationStimulantsCard
        selectedDateKey="2026-04-17"
        weekStartDay="monday"
        targets={BASE_TARGETS}
        waterTotalMl={0}
        waterFromMealsMl={0}
        caffeineTotalMg={0}
        alcoholByDayG={{}}
        measurementSystem="metric"
        onAddWater={onAddWater}
        onAddCaffeine={() => undefined}
        onAddAlcohol={() => undefined}
        onReset={() => undefined}
      />,
    );
    // Every chip exposes an `accessibilityLabel` in the form
    // "Add {N} millilitres water" on metric. Pin each canonical preset.
    for (const ml of WATER_QUICK_ADDS_ML) {
      const chip = getByLabelText(`Add ${ml} millilitres water`);
      expect(chip).toBeTruthy();
    }
    // Sanity: the canonical tuple hasn't drifted.
    expect([...WATER_QUICK_ADDS_ML]).toEqual([100, 250, 500, 750]);
  });

  it("renders the four imperial chip labels from imperialWaterQuickAdds()", () => {
    const chips = imperialWaterQuickAdds();
    const { getByLabelText } = render(
      <HydrationStimulantsCard
        selectedDateKey="2026-04-17"
        weekStartDay="monday"
        targets={BASE_TARGETS}
        waterTotalMl={0}
        waterFromMealsMl={0}
        caffeineTotalMg={0}
        alcoholByDayG={{}}
        measurementSystem="imperial"
        onAddWater={() => undefined}
        onAddCaffeine={() => undefined}
        onAddAlcohol={() => undefined}
        onReset={() => undefined}
      />,
    );
    // Imperial a11y label form: "Add {label} water" — pins the
    // display-unit + the helper-returned label simultaneously.
    for (const chip of chips) {
      const node = getByLabelText(`Add ${chip.label} water`);
      expect(node).toBeTruthy();
    }
    // Canonical imperial scale — one source of truth for the copy row
    // in this file + the helper + the card's visible label.
    expect(chips.map((c) => c.label)).toEqual([
      "4 fl oz",
      "8 fl oz",
      "16 fl oz",
      "20 fl oz",
    ]);
  });

  it("formats the water progress row in ml when measurementSystem=metric", () => {
    const { getByText } = render(
      <HydrationStimulantsCard
        selectedDateKey="2026-04-17"
        weekStartDay="monday"
        targets={BASE_TARGETS}
        waterTotalMl={250}
        waterFromMealsMl={0}
        caffeineTotalMg={0}
        alcoholByDayG={{}}
        measurementSystem="metric"
        onAddWater={() => undefined}
        onAddCaffeine={() => undefined}
        onAddAlcohol={() => undefined}
        onReset={() => undefined}
      />,
    );
    // `formatWaterAmount(2000, "metric")` returns `{ value: "2", unit: "L" }`
    // → the progress row reads "250 ml / 2 L" (ml under 1 L, L above).
    expect(getByText("250 ml / 2 L")).toBeTruthy();
  });

  it("formats the water progress row in fl oz when measurementSystem=imperial", () => {
    const { getByText } = render(
      <HydrationStimulantsCard
        selectedDateKey="2026-04-17"
        weekStartDay="monday"
        targets={BASE_TARGETS}
        waterTotalMl={237}
        waterFromMealsMl={0}
        caffeineTotalMg={0}
        alcoholByDayG={{}}
        measurementSystem="imperial"
        onAddWater={() => undefined}
        onAddCaffeine={() => undefined}
        onAddAlcohol={() => undefined}
        onReset={() => undefined}
      />,
    );
    // `formatWaterAmount(237, "imperial")` = 8 fl oz; target 2000 ml → 68 fl oz.
    expect(getByText("8 fl oz / 68 fl oz")).toBeTruthy();
  });

  it("invokes onAddWater with the helper's canonical `ml` value on chip tap (imperial storage-stays-metric invariant)", () => {
    const onAddWater = vi.fn();
    const chips = imperialWaterQuickAdds();
    const { getByLabelText } = render(
      <HydrationStimulantsCard
        selectedDateKey="2026-04-17"
        weekStartDay="monday"
        targets={BASE_TARGETS}
        waterTotalMl={0}
        waterFromMealsMl={0}
        caffeineTotalMg={0}
        alcoholByDayG={{}}
        measurementSystem="imperial"
        onAddWater={onAddWater}
        onAddCaffeine={() => undefined}
        onAddAlcohol={() => undefined}
        onReset={() => undefined}
      />,
    );
    // Tap the 8 fl oz chip → storage should receive 237 ml (the helper's
    // metric value for the 8 fl oz display preset).
    const eightOz = chips.find((c) => c.label === "8 fl oz");
    expect(eightOz).toBeDefined();
    fireEvent.press(getByLabelText("Add 8 fl oz water"));
    expect(onAddWater).toHaveBeenCalledTimes(1);
    expect(onAddWater).toHaveBeenCalledWith(eightOz!.ml);
  });
});
