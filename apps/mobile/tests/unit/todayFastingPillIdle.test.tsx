/**
 * F-109 (TestFlight `AFHtAQRAWad1w8bDvSgZkUg`, 2026-05-06).
 *
 * The Today fasting pill renders in three modes:
 *   - Active: when a fast is in flight (`startedAt` set)
 *   - Idle:   when the user opted in to IF but isn't currently fasting
 *   - Hidden: when the user has not opted in to IF at all
 *
 * The host (`(tabs)/index.tsx`) is responsible for the "hidden" branch —
 * it simply does not render the pill when `fastingOptedIn === false`.
 * This file pins the active vs idle pill rendering directly.
 */
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react-native";

import { TodayFastingPill } from "../../components/today/TodayFastingPill";

describe("TodayFastingPill — F-109 idle mode", () => {
  it("renders the active pill with elapsed time when startedAt is set", () => {
    const startedAt = new Date(Date.now() - 12 * 3600_000 - 43 * 60_000).toISOString();
    render(
      <TodayFastingPill
        startedAt={startedAt}
        nowTick={Date.now()}
        onPress={() => {}}
      />,
    );
    expect(screen.getByTestId("today-fasting-pill-active")).toBeTruthy();
    expect(screen.queryByTestId("today-fasting-pill-idle")).toBeNull();
    // Label shape: "Fasting — 12h 43m"
    expect(screen.getByText(/Fasting — 12h 4\dm/)).toBeTruthy();
  });

  it("renders the idle 'Start fast' pill when mode='idle'", () => {
    render(<TodayFastingPill mode="idle" onPress={() => {}} />);
    expect(screen.getByTestId("today-fasting-pill-idle")).toBeTruthy();
    expect(screen.queryByTestId("today-fasting-pill-active")).toBeNull();
    expect(screen.getByText("Start fast")).toBeTruthy();
  });
});
