/**
 * ENG-740 — merged Week-Digest card render pins (web).
 *
 * Covers the blended card structure (hero track + borderless metric
 * strip + PATTERN row + maintenance row + footer), the calorie-ring
 * hero tone, the PATTERN suppression gates, the empty/partial states,
 * and the flag-gating dispatch in `<Digest>` (blended vs legacy).
 *
 * The hero-track math + tone classifier are unit-tested in
 * `digest.test.ts`; here we pin that they wire into the DOM.
 */

import * as React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

void React;

import { Digest, type DigestProps } from "../../src/app/components/suppr/digest";
import type { DigestBlendedExtras } from "../../src/lib/nutrition/digest";

const baseProps: DigestProps = {
  weekKey: "2026-W21",
  weekLabel: "May 18–24",
  daysLogged: 7,
  mealsLogged: 22,
  headline: "Closest to target: Saturday.",
  stats: {
    streakDays: 7,
    streakFreezesAvailable: 0,
    avgCalories: 1017,
    avgProtein: 53,
    proteinAdherencePct: 52,
    weightDeltaKg: 0,
    weightFirstKg: 54.9,
    weightLastKg: 54.9,
  },
  narrative: {
    closestToTarget: { label: "Saturday", protein: 42, calories: 680 },
    maintenanceLine:
      "Maintenance landed around 1,568 kcal this week — formula said 1,670.",
    usualMeal: null,
  },
  shareText: "My week on Sloe",
  state: "success",
  onShare: () => {},
  onDismiss: () => {},
};

const extras: DigestBlendedExtras = {
  dayOfWeekPattern: {
    highDay: "Sunday",
    lowDay: "Friday",
    deltaKcal: 1657,
    highDayAvg: 2400,
    lowDayAvg: 743,
  },
  closestDayTargetCalories: 901,
};

function renderBlended(overrides: Partial<DigestProps> = {}) {
  return render(
    <Digest blended blendedExtras={extras} onAdjustPace={() => {}} {...baseProps} {...overrides} />,
  );
}

describe("DigestBlended — structure (web)", () => {
  it("renders ONE blended card with the merged data-attr", () => {
    renderBlended();
    const card = screen.getByTestId("digest");
    expect(card.getAttribute("data-blended")).toBe("true");
  });

  it("renders the closest-day hero with day name, calories, and target", () => {
    renderBlended();
    expect(screen.getByTestId("digest-hero-day").textContent).toBe("Saturday");
    expect(screen.getByTestId("digest-hero-calories").textContent).toContain("680");
    expect(screen.getByTestId("digest-hero-protein").textContent).toContain("42g protein");
    // Hero track present + dot tone = under target (680 < 901).
    expect(screen.getByTestId("digest-hero-track")).toBeTruthy();
    expect(screen.getByTestId("digest-hero-dot").getAttribute("data-tone")).toBe("under");
  });

  it("renders the borderless metric strip with protein % in the on-target tone", () => {
    renderBlended();
    const strip = screen.getByTestId("digest-stat-strip");
    expect(strip.textContent).toContain("Streak");
    expect(strip.textContent).toContain("1,017");
    expect(strip.textContent).toContain("52% of target");
    expect(strip.textContent).toContain("54.9→54.9");
  });

  it("renders the PATTERN row with the two-bar comparison + delta", () => {
    renderBlended();
    expect(screen.getByTestId("digest-pattern-summary").textContent).toBe(
      "Sundays ran higher than Fridays over the last 4 weeks",
    );
    expect(screen.getByTestId("digest-pattern-delta").textContent).toContain("+1,657 kcal");
  });

  // ENG-1373 (finding 4b) — the PATTERN row compares a 4-week rolling mean
  // per weekday, not the single displayed week; the copy must attribute the
  // claim to `patternWindowLabel` instead of implying "this week".
  it("attributes the PATTERN row claim to patternWindowLabel when supplied", () => {
    render(
      <Digest
        blended
        blendedExtras={{ ...extras, patternWindowLabel: "last 4 weeks" }}
        onAdjustPace={() => {}}
        {...baseProps}
      />,
    );
    expect(screen.getByTestId("digest-pattern-summary").textContent).toBe(
      "Sundays ran higher than Fridays over the last 4 weeks",
    );
  });

  it("renders the maintenance row + Adjust pace link when wired", () => {
    renderBlended();
    expect(screen.getByTestId("digest-maintenance-line").textContent).toContain(
      "Maintenance landed around",
    );
    expect(screen.getByTestId("digest-adjust-pace")).toBeTruthy();
  });

  it("renders Share week as the only filled button + Got it as muted text", () => {
    renderBlended();
    expect(screen.getByRole("button", { name: "Share week digest" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Got it" })).toBeTruthy();
  });
});

describe("DigestBlended — hero tone (calorie-ring 3-state)", () => {
  it("flags the hero dot 'over' when the closest day exceeded its target", () => {
    renderBlended({
      narrative: {
        ...baseProps.narrative,
        closestToTarget: { label: "Saturday", protein: 42, calories: 1100 },
      },
    });
    expect(screen.getByTestId("digest-hero-dot").getAttribute("data-tone")).toBe("over");
  });

  it("omits the hero track (but keeps calories) when no per-day target exists", () => {
    render(
      <Digest
        blended
        blendedExtras={{ dayOfWeekPattern: null, closestDayTargetCalories: null }}
        {...baseProps}
      />,
    );
    expect(screen.queryByTestId("digest-hero-track")).toBeNull();
    expect(screen.getByTestId("digest-hero-calories").textContent).toContain("680");
  });
});

describe("DigestBlended — suppression gates", () => {
  it("suppresses the PATTERN row when fewer than 4 days are logged", () => {
    renderBlended({ daysLogged: 3, state: "partial" });
    expect(screen.queryByTestId("digest-pattern")).toBeNull();
  });

  it("suppresses the PATTERN row when the host supplies no pattern", () => {
    render(
      <Digest
        blended
        blendedExtras={{ dayOfWeekPattern: null, closestDayTargetCalories: 901 }}
        {...baseProps}
      />,
    );
    expect(screen.queryByTestId("digest-pattern")).toBeNull();
    // The hero track still renders — the closest-day target is present.
    expect(screen.getByTestId("digest-hero-track")).toBeTruthy();
  });

  it("suppresses the maintenance row when the host passes null (low TDEE confidence)", () => {
    renderBlended({
      narrative: { ...baseProps.narrative, maintenanceLine: null },
    });
    expect(screen.queryByTestId("digest-maintenance-line")).toBeNull();
  });

  it("hides the Adjust pace link when no handler is supplied", () => {
    render(<Digest blended blendedExtras={extras} {...baseProps} />);
    expect(screen.queryByTestId("digest-adjust-pace")).toBeNull();
  });
});

describe("DigestBlended — empty state", () => {
  it("renders a calm empty hero without inventing numbers", () => {
    render(
      <Digest
        blended
        blendedExtras={extras}
        {...baseProps}
        daysLogged={0}
        state="empty"
        headline="Quiet week."
        narrative={{ closestToTarget: null, maintenanceLine: null, usualMeal: null }}
      />,
    );
    expect(screen.getByTestId("digest-hero-empty").textContent).toBe("Quiet week.");
    // No PATTERN row, no maintenance row on an empty week.
    expect(screen.queryByTestId("digest-pattern")).toBeNull();
    expect(screen.queryByTestId("digest-maintenance-line")).toBeNull();
  });
});

describe("Digest dispatcher — flag gating both branches", () => {
  it("renders the LEGACY stacked layout when `blended` is absent/false", () => {
    render(<Digest {...baseProps} />);
    const card = screen.getByTestId("digest");
    // Legacy card has no data-blended attr; it does carry data-state.
    expect(card.getAttribute("data-blended")).toBeNull();
    expect(card.getAttribute("data-state")).toBe("success");
    // Legacy renders the closest-to-target sentence, not a hero day node.
    expect(screen.getByTestId("digest-closest-to-target")).toBeTruthy();
    expect(screen.queryByTestId("digest-hero-day")).toBeNull();
  });

  it("renders the BLENDED card when `blended` is true", () => {
    render(<Digest blended blendedExtras={extras} {...baseProps} />);
    const card = screen.getByTestId("digest");
    expect(card.getAttribute("data-blended")).toBe("true");
    expect(screen.getByTestId("digest-hero-day")).toBeTruthy();
    // Legacy-only sentence node must be absent in the blended layout.
    expect(screen.queryByTestId("digest-closest-to-target")).toBeNull();
  });
});
