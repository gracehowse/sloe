/**
 * TodayAppleHealthCard — desktop right-rail Apple Health summary.
 * Tests pin the no-fabrication rules (dim "—" placeholder when a
 * value hasn't synced yet, weight row omitted entirely when null,
 * kg/lb formatting respects measurement system).
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { TodayAppleHealthCard } from "../../src/app/components/suppr/today-apple-health-card";

describe("TodayAppleHealthCard", () => {
  const base = {
    stepsForSelectedDay: null as number | null,
    activeEnergyKcal: null as number | null,
    restingBurnKcal: null as number | null,
    latestWeightKg: null as number | null,
  };

  it("renders dim placeholders and a connect-source hint when no Health data has synced", () => {
    render(<TodayAppleHealthCard {...base} />);
    // All three placeholder rows read "—".
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(3);
    // Weight row is omitted entirely when latestWeightKg is null.
    expect(screen.queryByText(/Weight/)).toBeNull();
    expect(
      screen.getByText(/Data appears once the iOS app connects Apple Health\./),
    ).toBeDefined();
  });

  it("renders concrete values when Health has synced", () => {
    render(
      <TodayAppleHealthCard
        {...base}
        stepsForSelectedDay={8421}
        activeEnergyKcal={440}
        restingBurnKcal={1580}
        latestWeightKg={72.5}
      />,
    );
    expect(screen.getByText("8,421")).toBeDefined();
    expect(screen.getByText("440 kcal")).toBeDefined();
    expect(screen.getByText("1,580 kcal")).toBeDefined();
    expect(screen.getByText("72.5 kg")).toBeDefined();
    // With data present, no hint line.
    expect(
      screen.queryByText(/Data appears once the iOS app connects Apple Health\./),
    ).toBeNull();
  });

  it("formats weight in lb when useImperial is true", () => {
    render(
      <TodayAppleHealthCard
        {...base}
        latestWeightKg={72.5}
        useImperial
      />,
    );
    // 72.5 kg → 159.8 lb
    expect(screen.getByText(/159\.8 lb/)).toBeDefined();
    expect(screen.queryByText(/72\.5 kg/)).toBeNull();
  });

  it("shows partial data without fabricating a zero weight", () => {
    render(
      <TodayAppleHealthCard
        {...base}
        stepsForSelectedDay={5000}
      />,
    );
    expect(screen.getByText("5,000")).toBeDefined();
    // Resting + active are still dim.
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
    // Weight row absent — we never render "0.0 kg" as a faux value.
    expect(screen.queryByText(/Weight/)).toBeNull();
  });
});
