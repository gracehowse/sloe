// @vitest-environment jsdom
/**
 * PlanHeaderV3 (ENG-1225, v3 Plan IA) — WEB parity twin of the mobile header.
 * Pins the prototype contract (Sloe-App.html Plan ~L4707-4721): date overline +
 * "Your plan" title, three action buttons, and a verdict row driven by
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
  headline: "On track — 4 of 7 days land",
  subline: "3 days need a meal or swap",
  tone: "warning",
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
    expect(getByText("On track — 4 of 7 days land")).not.toBeNull();
    expect(getByText("3 days need a meal or swap")).not.toBeNull();
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
    expect(queryByText(/days land/)).toBeNull();
  });

  it("exposes the three action buttons and fires their handlers", () => {
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
    fireEvent.click(getByLabelText("Plan templates"));
    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onAdjust).toHaveBeenCalledTimes(1);
    expect(onTemplates).toHaveBeenCalledTimes(1);
  });
});
