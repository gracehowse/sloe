// @vitest-environment jsdom
/**
 * PlanHeaderV3 (ENG-1225, v3 Plan IA) — WEB parity twin of the mobile header.
 * Pins the prototype contract (Sloe-App.html Plan ~L4707-4721): date overline +
 * "Your plan" title, two action buttons (generate / templates), and a verdict row driven by
 * `computePlanWeekVerdict` (completeness, not calorie accuracy). Mirrors
 * `apps/mobile/tests/unit/planHeaderV3.test.tsx`.
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PlanHeaderV3 } from "../../src/app/components/plan/PlanHeaderV3";
import type { PlanWeekVerdict } from "../../src/lib/planning/planWeekStatus";

void React;

const partial: PlanWeekVerdict = {
  daysHit: 4,
  total: 7,
  headline: "On track — 4 of 7 days on target",
  subline: "3 days need a meal or swap",
  tone: "neutral",
};
const win: PlanWeekVerdict = {
  daysHit: 7,
  total: 7,
  headline: "Every day lands on target",
  subline: null,
  tone: "success",
};

const baseProps = {
  dateRangeLabel: "16–22 June",
  onGenerate: () => {},
  onAdjust: () => {},
  onTemplates: () => {},
};

describe("PlanHeaderV3 (web)", () => {
  it("renders the title + uppercased date overline", () => {
    const { getByText } = render(<PlanHeaderV3 {...baseProps} verdict={partial} />);
    expect(getByText("Your plan")).not.toBeNull();
    expect(getByText("16–22 JUNE")).not.toBeNull();
  });

  it("renders the partial verdict headline + nudge subline", () => {
    const { getByText } = render(<PlanHeaderV3 {...baseProps} verdict={partial} />);
    expect(getByText("On track — 4 of 7 days on target")).not.toBeNull();
    expect(getByText("3 days need a meal or swap")).not.toBeNull();
  });

  it("ENG-1547 — 'On track' (neutral) pairs with the calm dot, NOT the amber warning dot", () => {
    const { container } = render(<PlanHeaderV3 {...baseProps} verdict={partial} />);
    const dot = container.querySelector(".size-2.rounded-full") as HTMLElement | null;
    expect(dot).not.toBeNull();
    expect(dot!.style.backgroundColor).toBe("var(--foreground-tertiary)");
    // The win state still uses the success dot.
    const { container: winC } = render(<PlanHeaderV3 {...baseProps} verdict={win} />);
    const winDot = winC.querySelector(".size-2.rounded-full") as HTMLElement | null;
    expect(winDot!.style.backgroundColor).toBe("var(--accent-success)");
  });

  it("renders the win verdict with no nudge subline", () => {
    const { getByText, queryByText } = render(
      <PlanHeaderV3 {...baseProps} verdict={win} />,
    );
    expect(getByText("Every day lands on target")).not.toBeNull();
    expect(queryByText(/need[s]? a meal or swap/)).toBeNull();
  });

  it("hides the verdict row when verdict is null (header still renders)", () => {
    const { getByText, queryByText } = render(
      <PlanHeaderV3 {...baseProps} verdict={null} />,
    );
    expect(getByText("Your plan")).not.toBeNull();
    expect(queryByText(/days on target/)).toBeNull();
  });

  it("exposes the action buttons and fires their handlers", () => {
    const onGenerate = vi.fn();
    const onAdjust = vi.fn();
    const onTemplates = vi.fn();
    const { getByLabelText } = render(
      <PlanHeaderV3
        {...baseProps}
        verdict={partial}
        onGenerate={onGenerate}
        onAdjust={onAdjust}
        onTemplates={onTemplates}
      />,
    );
    fireEvent.click(getByLabelText("Generate week"));
    fireEvent.click(getByLabelText("Adjust constraints"));
    fireEvent.click(getByLabelText("Templates"));
    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onAdjust).toHaveBeenCalledTimes(1);
    expect(onTemplates).toHaveBeenCalledTimes(1);
  });
});
