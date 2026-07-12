/**
 * TodayAppleHealthCard — desktop right-rail Apple Health summary.
 * Tests pin the no-fabrication rules (renders NOTHING when no Health
 * datum exists at all — ENG-1495; dim "—" placeholder when only some
 * values haven't synced; weight row omitted entirely when null;
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

  it("renders nothing at all when no Health data has synced (ENG-1495)", () => {
    const { container } = render(<TodayAppleHealthCard {...base} />);
    // No placeholder-only card — the section doesn't mount.
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText("—")).toBeNull();
    expect(screen.queryByText(/Apple Health · Today/)).toBeNull();
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
