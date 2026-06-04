// @vitest-environment jsdom
/**
 * `HydrationStimulantsCard` — Sloe `TD2 · Hydration & stimulants` re-skin
 * (Today re-skin unit 3, 2026-06-03). Figma 463:2 /
 * `docs/prototypes/stitch-sloe/today-hydration.html`.
 *
 * The TD2 frame splits the single legacy card into TWO Sloe cards
 * ("Hydration" + "Stimulants"). The pre-existing helper-parity contracts
 * (chip labels, ml↔fl-oz, storage-stays-metric) stay covered by
 * `hydrationStimulantsCardParity.test.tsx`, all still green. This file pins
 * the NEW structure + the PRESERVED opt-in self-hide:
 *   1. The Hydration card always renders; the Stimulants card renders only
 *      when at least one stimulant is opted in (target > 0).
 *   2. With BOTH stimulant targets 0 (Settings opt-out), the Stimulants
 *      card is omitted entirely — but Water still works.
 *   3. Caffeine / Alcohol rows still self-hide individually by target.
 *   4. The add handlers still fire with the canonical preset values.
 *   5. Alcohol is still shown in GRAMS (never relabelled "units") — the
 *      data is grams-weekly, so the unit must stay honest.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

import { HydrationStimulantsCard } from "../../components/HydrationStimulantsCard";

void React;

const NOOP = () => undefined;

function renderCard(overrides: {
  targets?: { waterMl: number; caffeineMg: number; alcoholGWeekly: number };
  onAddWater?: (ml: number) => void;
  onAddCaffeine?: (mg: number, preset?: string | null) => void;
  onAddAlcohol?: (g: number, preset?: string | null) => void;
}) {
  return render(
    <HydrationStimulantsCard
      selectedDateKey="2026-06-03"
      weekStartDay="monday"
      targets={
        overrides.targets ?? { waterMl: 2000, caffeineMg: 400, alcoholGWeekly: 112 }
      }
      waterTotalMl={0}
      waterFromMealsMl={0}
      caffeineTotalMg={0}
      alcoholByDayG={{}}
      measurementSystem="metric"
      onAddWater={overrides.onAddWater ?? NOOP}
      onAddCaffeine={overrides.onAddCaffeine ?? NOOP}
      onAddAlcohol={overrides.onAddAlcohol ?? NOOP}
      onReset={NOOP}
    />,
  );
}

describe("HydrationStimulantsCard — TD2 two-card split", () => {
  it("renders separate 'Hydration' and 'Stimulants' cards when both are present", () => {
    const { getByTestId, getByText } = renderCard({});
    expect(getByTestId("today-hydration-card")).toBeTruthy();
    expect(getByTestId("today-stimulants-card")).toBeTruthy();
    expect(getByText("Hydration")).toBeTruthy();
    expect(getByText("Stimulants")).toBeTruthy();
  });

  it("omits the Stimulants card entirely when both stimulants are opted out (targets 0)", () => {
    const { getByTestId, queryByTestId, getByLabelText } = renderCard({
      targets: { waterMl: 2000, caffeineMg: 0, alcoholGWeekly: 0 },
    });
    // Hydration still present + usable.
    expect(getByTestId("today-hydration-card")).toBeTruthy();
    expect(getByLabelText("Add 250 millilitres water")).toBeTruthy();
    // Stimulants card gone (the Settings opt-in default-off path).
    expect(queryByTestId("today-stimulants-card")).toBeNull();
  });

  it("self-hides caffeine while keeping alcohol when only alcohol is opted in", () => {
    const { getByTestId, getByText, queryByText } = renderCard({
      targets: { waterMl: 2000, caffeineMg: 0, alcoholGWeekly: 112 },
    });
    expect(getByTestId("today-stimulants-card")).toBeTruthy();
    expect(queryByText("Caffeine")).toBeNull();
    expect(getByText("Alcohol")).toBeTruthy();
  });
});

describe("HydrationStimulantsCard — TD2 handlers + honest units preserved", () => {
  it("fires onAddWater with the canonical ml value", () => {
    const onAddWater = vi.fn();
    const { getByLabelText } = renderCard({ onAddWater });
    fireEvent.press(getByLabelText("Add 250 millilitres water"));
    expect(onAddWater).toHaveBeenCalledWith(250);
  });

  it("fires onAddCaffeine + onAddAlcohol with the canonical preset values", () => {
    const onAddCaffeine = vi.fn();
    const onAddAlcohol = vi.fn();
    const { getByLabelText } = renderCard({ onAddCaffeine, onAddAlcohol });
    // "Coffee (240ml)" = 95 mg — first of CAFFEINE_QUICK_ADDS (card shows
    // the first 4).
    fireEvent.press(getByLabelText("Add Coffee (240ml): 95 milligrams caffeine"));
    expect(onAddCaffeine).toHaveBeenCalledWith(95, "Coffee (240ml)");
    // "Beer 500ml" = 16 g — first of ALCOHOL_QUICK_ADDS.
    fireEvent.press(getByLabelText("Add Beer 500ml: 16 grams alcohol"));
    expect(onAddAlcohol).toHaveBeenCalledWith(16, "Beer 500ml");
  });

  it("shows alcohol in grams (never relabelled 'units') — the data is grams-weekly", () => {
    const { getByText, queryByText } = renderCard({
      targets: { waterMl: 2000, caffeineMg: 0, alcoholGWeekly: 112 },
    });
    // The value renders as "{g} / {target} g this week"; the unit suffix
    // must read "g this week", not "units".
    expect(getByText(/g this week/)).toBeTruthy();
    expect(queryByText(/units this week/)).toBeNull();
  });
});
