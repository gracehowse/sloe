// @vitest-environment jsdom
/**
 * WeeklyCheckinDialog — render + interaction pins (web parity).
 *
 * Web mirror of `apps/mobile/tests/unit/weeklyCheckinModal.test.tsx`.
 * The dialog is the user-facing surface of the weekly TDEE check-in
 * ritual (PR claude/weekly-checkin-ritual-v2, 2026-05-02 — rebuild of
 * #26). Gating + content build are unit-covered in
 * `tests/unit/weeklyCheckin.test.ts` — these tests pin the rendered
 * output:
 *
 *   1. Headline + why-line render verbatim from the content payload.
 *   2. The "from → to" target row uses the suggested target as the
 *      bold value with the previous target struck-through next to it.
 *   3. Both CTAs (Accept / Keep current) call their respective
 *      handlers exactly once on click.
 *   4. The weight-delta row is suppressed when null (we never
 *      fabricate "+0.0 kg").
 *   5. Tabular-nums style is applied to the suggested target value.
 *   6. `null` content renders nothing (defensive guard).
 */

import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { WeeklyCheckinDialog } from "../../src/app/components/suppr/weekly-checkin-dialog";
import type { WeeklyCheckinContent } from "../../src/lib/nutrition/weeklyCheckin";

void React;

function makeContent(
  overrides: Partial<WeeklyCheckinContent> = {},
): WeeklyCheckinContent {
  return {
    tdeeDeltaKcal: 200,
    suggestedTargetKcal: 2000,
    headline: "Your weekly check-in is ready",
    whyLine: "Your real burn is +200 kcal higher than the formula.",
    avgThisWeekLabel: "1,750 kcal/day",
    weightDeltaLabel: "−0.4 kg",
    ...overrides,
  };
}

describe("WeeklyCheckinDialog (web parity)", () => {
  it("renders the headline + why line from content", () => {
    render(
      <WeeklyCheckinDialog
        open
        content={makeContent()}
        currentTargetKcal={1800}
        onAccept={() => {}}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByText("Your weekly check-in is ready")).toBeInTheDocument();
    expect(screen.getByText(/higher than the formula/)).toBeInTheDocument();
  });

  it("renders avg-this-week, weight delta, and TDEE delta rows", () => {
    render(
      <WeeklyCheckinDialog
        open
        content={makeContent()}
        currentTargetKcal={1800}
        onAccept={() => {}}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByText("Avg this week")).toBeInTheDocument();
    expect(screen.getByText("1,750 kcal/day")).toBeInTheDocument();
    expect(screen.getByText("Weight delta")).toBeInTheDocument();
    expect(screen.getByText("−0.4 kg")).toBeInTheDocument();
    expect(screen.getByText("TDEE delta")).toBeInTheDocument();
    expect(screen.getByText("+200 kcal")).toBeInTheDocument();
  });

  it("suppresses the weight-delta row when label is null", () => {
    render(
      <WeeklyCheckinDialog
        open
        content={makeContent({ weightDeltaLabel: null })}
        currentTargetKcal={1800}
        onAccept={() => {}}
        onDismiss={() => {}}
      />,
    );
    expect(screen.queryByText("Weight delta")).not.toBeInTheDocument();
  });

  it("renders the previous target struck-through next to the bold suggested target", () => {
    render(
      <WeeklyCheckinDialog
        open
        content={makeContent()}
        currentTargetKcal={1800}
        onAccept={() => {}}
        onDismiss={() => {}}
      />,
    );
    // Previous (struck-through)
    const prev = screen.getByText("1,800");
    expect(prev).toHaveClass("line-through");
    // Suggested (bold + tabular nums via aria-label)
    const suggested = screen.getByLabelText(
      "Suggested 2000 kilocalories per day",
    );
    expect(suggested).toBeInTheDocument();
    expect(suggested.textContent).toBe("2,000");
    expect(suggested.style.fontVariantNumeric).toBe("tabular-nums");
  });

  it("calls onAccept exactly once when the primary CTA is clicked", () => {
    const onAccept = vi.fn();
    render(
      <WeeklyCheckinDialog
        open
        content={makeContent()}
        currentTargetKcal={1800}
        onAccept={onAccept}
        onDismiss={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Accept new target" }));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss when 'Keep current' is clicked", () => {
    const onDismiss = vi.fn();
    render(
      <WeeklyCheckinDialog
        open
        content={makeContent()}
        currentTargetKcal={1800}
        onAccept={() => {}}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Keep current target" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when content is null (defensive guard)", () => {
    const { container } = render(
      <WeeklyCheckinDialog
        open
        content={null}
        currentTargetKcal={1800}
        onAccept={() => {}}
        onDismiss={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
