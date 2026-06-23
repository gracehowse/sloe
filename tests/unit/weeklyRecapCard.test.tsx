// @vitest-environment jsdom
/**
 * WeeklyRecapCard — the shareable weekly-recap artifact (ENG-1225 #4). Pins the
 * load-bearing content: on-target hero, 7-day sparkline, narrative, and the
 * sloe.co watermark (the growth hook — it must always be present).
 */
import * as React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WeeklyRecapCard } from "../../src/app/components/suppr/weekly-recap-card";

void React;

const base = {
  weekLabel: "16–22 Jun",
  onTargetDays: 5,
  dailyCalories: [1980, 2120, 1850, 2460, 1920, 2050, null] as (number | null)[],
  targetCalories: 2100,
  narrative: "A steady, consistent week.",
};

describe("WeeklyRecapCard", () => {
  it("renders the on-target hero + accessible summary", () => {
    const { container, getByTestId } = render(<WeeklyRecapCard {...base} />);
    const svg = getByTestId("weekly-recap-card");
    expect(svg.getAttribute("aria-label")).toMatch(/5 of 7 days on target/);
    expect(container.textContent).toContain("days on target");
    expect(container.textContent).toContain("A steady, consistent week.");
  });

  it("always carries the sloe.co watermark (the growth hook)", () => {
    const { container } = render(<WeeklyRecapCard {...base} />);
    expect(container.textContent).toContain("sloe.co");
  });

  it("draws seven day bars (one per weekday)", () => {
    const { container } = render(<WeeklyRecapCard {...base} />);
    // 7 bars: 6 logged (full) + 1 no-log (stub). Plus the bg + bloom rects.
    const dayLabels = [...container.querySelectorAll("text")].filter((t) =>
      ["M", "T", "W", "F", "S"].includes((t.textContent ?? "").trim()),
    );
    expect(dayLabels.length).toBe(7);
  });

  it("truncates an over-long narrative so it can't overflow the card", () => {
    const long = "x".repeat(80);
    const { container } = render(<WeeklyRecapCard {...base} narrative={long} />);
    expect(container.textContent).toContain("…");
  });
});
