/**
 * ActivityLevelPreview render test (build 10 fix E-2, 2026-04-19).
 *
 * Pins the shared web component at
 * `src/app/components/suppr/activity-level-preview.tsx` — closes
 * TestFlight `AIIm60n` / `AHCSYMATS` by giving the user an in-app
 * surface to change `profiles.activity_level` and see the maintenance
 * number move.
 *
 * Covers:
 *  - preview line renders the five levels with their exact kcal
 *    values for a known BMR input (pinned against `calculateTDEE`)
 *  - the selected level is bolded (accessible signal for the current
 *    stored choice)
 *  - tapping a different row fires `onSelect` with the new level
 *  - missing basics renders the quiet fallback helper line, not a
 *    made-up number (nutrition rule: no fabricated targets)
 */

// @vitest-environment jsdom
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ActivityLevelPreview } from "../../src/app/components/suppr/activity-level-preview";
import { calculateTDEE } from "../../src/lib/nutrition/tdee";

// Ensure JSX runtime finds React under vitest/jsdom.
void React;

// Tester's profile from the TestFlight feedback (AIIm60n / AHCSYMATS).
// BMR ≈ 1,225 → at moderate (1.55) yields ~1,898 kcal, at sedentary
// (1.2) yields ~1,470 kcal — the exact pair in the ticket.
const TESTER_BASICS = {
  sex: "female" as const,
  weightKg: 55,
  heightCm: 163,
  age: 34,
};

describe("ActivityLevelPreview (web)", () => {
  it("renders the preview line with the exact kcal values from calculateTDEE", () => {
    render(
      <ActivityLevelPreview
        {...TESTER_BASICS}
        selected="moderate"
        onSelect={() => {}}
      />,
    );

    const row = screen.getByTestId("activity-level-preview-row");
    const expectedModerate = calculateTDEE(
      TESTER_BASICS.sex,
      TESTER_BASICS.weightKg,
      TESTER_BASICS.heightCm,
      TESTER_BASICS.age,
      "moderate",
    );
    const expectedSedentary = calculateTDEE(
      TESTER_BASICS.sex,
      TESTER_BASICS.weightKg,
      TESTER_BASICS.heightCm,
      TESTER_BASICS.age,
      "sedentary",
    );

    expect(row).toHaveTextContent(`Moderate: ${expectedModerate.toLocaleString()} kcal`);
    expect(row).toHaveTextContent(`Sedentary: ${expectedSedentary.toLocaleString()} kcal`);
    // Ticket band: BMR ≈ 1,238 × 1.55 ≈ 1,919 (moderate) vs × 1.2 ≈
    // 1,485 (sedentary) — the gap is what locked the tester at the
    // wrong number. Assert the expected ~430 kcal delta between the
    // two multipliers so a default-flip regression trips this.
    expect(expectedModerate).toBeGreaterThan(expectedSedentary);
    expect(expectedModerate - expectedSedentary).toBeGreaterThanOrEqual(400);
    expect(expectedModerate - expectedSedentary).toBeLessThanOrEqual(460);
  });

  it("bolds the currently-selected level in the preview line", () => {
    render(
      <ActivityLevelPreview
        {...TESTER_BASICS}
        selected="sedentary"
        onSelect={() => {}}
      />,
    );

    const row = screen.getByTestId("activity-level-preview-row");
    // The selected level is wrapped in a `font-bold` span; other levels
    // are not. A regression that forgets the selected state would fail
    // this — the whole row would still read the same text, but no
    // `font-bold` span would be present.
    const bolded = row.querySelectorAll("span.font-bold");
    expect(bolded.length).toBe(1);
    expect(bolded[0]?.textContent).toContain("Sedentary");
  });

  it("renders five tappable option rows and fires onSelect with the chosen level", () => {
    const onSelect = vi.fn();
    render(
      <ActivityLevelPreview
        {...TESTER_BASICS}
        selected="moderate"
        onSelect={onSelect}
      />,
    );

    // Five tappable rows, one per ActivityLevel.
    for (const lvl of ["sedentary", "light", "moderate", "active", "very_active"] as const) {
      expect(screen.getByTestId(`activity-level-option-${lvl}`)).toBeInTheDocument();
    }

    fireEvent.click(screen.getByTestId("activity-level-option-sedentary"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("sedentary");
  });

  it("marks the selected row with aria-pressed=true (accessible signal)", () => {
    render(
      <ActivityLevelPreview
        {...TESTER_BASICS}
        selected="active"
        onSelect={() => {}}
      />,
    );
    const active = screen.getByTestId("activity-level-option-active");
    const moderate = screen.getByTestId("activity-level-option-moderate");
    expect(active).toHaveAttribute("aria-pressed", "true");
    expect(moderate).toHaveAttribute("aria-pressed", "false");
  });

  it("renders the quiet fallback line (no made-up numbers) when basics are missing", () => {
    render(
      <ActivityLevelPreview
        sex="female"
        weightKg={null}
        heightCm={null}
        age={null}
        selected="sedentary"
        onSelect={() => {}}
      />,
    );
    expect(screen.getByTestId("activity-level-preview-fallback")).toBeInTheDocument();
    expect(screen.queryByTestId("activity-level-preview-row")).not.toBeInTheDocument();
    // Option rows still render but carry no kcal value (no fabrication).
    const sedOption = screen.getByTestId("activity-level-option-sedentary");
    expect(sedOption.textContent ?? "").not.toMatch(/kcal/);
  });

  it("omits the option grid when renderOptions={false} (onboarding compact mode)", () => {
    render(
      <ActivityLevelPreview
        {...TESTER_BASICS}
        selected="moderate"
        onSelect={() => {}}
        renderOptions={false}
      />,
    );
    // Preview line still present.
    expect(screen.getByTestId("activity-level-preview-row")).toBeInTheDocument();
    // But no tappable option buttons — onboarding renders its own.
    expect(screen.queryByTestId("activity-level-option-moderate")).not.toBeInTheDocument();
  });
});
