// @vitest-environment jsdom
/**
 * PlanEmptyWeekCard / PlanGhostSlotPill / PlanWeekAimLegend (web) — ENG-1372.
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PlanEmptyWeekCard } from "../../src/app/components/plan/PlanEmptyWeekCard";
import {
  PlanGhostSlotPill,
  PlanWeekAimLegend,
} from "../../src/app/components/suppr/plan-empty-week-grid";

void React;

describe("PlanEmptyWeekCard", () => {
  it("renders the headline + both actions and fires their handlers", () => {
    let generated = false;
    let addedAsYouGo = false;
    const { getByText } = render(
      <PlanEmptyWeekCard
        onGenerate={() => (generated = true)}
        onAddMealsAsYouGo={() => (addedAsYouGo = true)}
      />,
    );
    expect(getByText("Nothing planned yet")).not.toBeNull();
    fireEvent.click(getByText("Generate this week"));
    expect(generated).toBe(true);
    fireEvent.click(getByText("or add meals as you go"));
    expect(addedAsYouGo).toBe(true);
  });

  it("sits on the warm-tint ground token", () => {
    const { getByTestId } = render(
      <PlanEmptyWeekCard onGenerate={() => {}} onAddMealsAsYouGo={() => {}} />,
    );
    expect(getByTestId("plan-empty-week-card").className).toContain("bg-surface-warm");
  });
});

describe("PlanGhostSlotPill", () => {
  it("renders only the slot name — no Aim number, no icon", () => {
    const { getByTestId, queryByText } = render(<PlanGhostSlotPill slot="Breakfast" />);
    const pill = getByTestId("plan-ghost-slot-breakfast");
    expect(pill.textContent).toBe("Breakfast");
    expect(queryByText(/Aim ~/)).toBeNull();
  });
});

describe("PlanWeekAimLegend", () => {
  it("renders each slot's Aim once", () => {
    const { getByText, queryByText } = render(
      <PlanWeekAimLegend
        slots={[
          { slot: "Breakfast", aimKcal: 475 },
          { slot: "Lunch", aimKcal: 570 },
          { slot: "Dinner", aimKcal: 665 },
        ]}
      />,
    );
    expect(getByText("Aim ~475 kcal")).not.toBeNull();
    expect(getByText("Aim ~570 kcal")).not.toBeNull();
    expect(getByText("Aim ~665 kcal")).not.toBeNull();
    expect(queryByText("Aim ~0 kcal")).toBeNull();
  });

  it("renders nothing when there are no slots to legend", () => {
    const { container } = render(<PlanWeekAimLegend slots={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
