/**
 * Figma `654:2` Today's Meals summary layout — web.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  TodayMealsFigmaLayout,
  SloeCheckIcon,
  SloePlusIcon,
} from "../../src/app/components/suppr/today-meals-figma-layout";

const ROOT = resolve(__dirname, "../..");
const WEB_MEALS = readFileSync(
  resolve(ROOT, "src/app/components/suppr/today-meals-section.tsx"),
  "utf8",
);
const TRACK = readFileSync(resolve(ROOT, "src/lib/analytics/track.ts"), "utf8");
const MOBILE_MEALS = readFileSync(
  resolve(ROOT, "apps/mobile/components/today/TodayMealsSection.tsx"),
  "utf8",
);

describe("TodayMealsFigmaLayout (web)", () => {
  it("renders header kcal total and logged summary cards", () => {
    render(
      <TodayMealsFigmaLayout
        mealsGrouped={[
          {
            name: "Breakfast",
            meals: [
              {
                id: "1",
                name: "Breakfast",
                recipeTitle: "Blueberry Baked Oats",
                calories: 320,
                protein: 12,
                carbs: 40,
                fat: 8,
              },
            ],
          },
        ]}
        collapsedSlots={new Set()}
        onToggleSlot={vi.fn()}
        onOpenAddForSlot={vi.fn()}
      />,
    );
    expect(screen.getByTestId("today-meals-figma-header")).toBeTruthy();
    expect(screen.getByTestId("today-meals-kcal-total").textContent).toMatch(
      /320 kcal total/,
    );
    expect(screen.getByTestId("today-meals-figma-card-Breakfast")).toBeTruthy();
    expect(screen.getByText("Logged")).toBeTruthy();
    expect(screen.getByText("Blueberry Baked Oats")).toBeTruthy();
    expect(screen.getByText(/320 kcal • 12g P/)).toBeTruthy();
    expect(screen.getByTestId("today-log-slot-cta-Lunch")).toBeTruthy();
  });

  it("uses Sloe stroke icons (not Lucide CircleCheck)", () => {
    const { container } = render(
      <>
        <SloeCheckIcon data-testid="check" />
        <SloePlusIcon data-testid="plus" />
      </>,
    );
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBe(2);
    for (const svg of svgs) {
      expect(svg.getAttribute("stroke-width") ?? svg.getAttribute("strokeWidth")).toBeTruthy();
    }
  });

  it("Log next slot CTA opens add for that slot", () => {
    const onOpenAddForSlot = vi.fn();
    render(
      <TodayMealsFigmaLayout
        mealsGrouped={[
          {
            name: "Breakfast",
            meals: [
              {
                id: "1",
                name: "Breakfast",
                recipeTitle: "Oats",
                calories: 100,
                protein: 5,
                carbs: 10,
                fat: 2,
              },
            ],
          },
        ]}
        collapsedSlots={new Set()}
        onToggleSlot={vi.fn()}
        onOpenAddForSlot={onOpenAddForSlot}
      />,
    );
    fireEvent.click(screen.getByTestId("today-log-slot-cta-Lunch"));
    expect(onOpenAddForSlot).toHaveBeenCalledWith("Lunch");
  });
});

describe("today_meals_figma_654 flag wiring", () => {
  it("defaults ON in redesign set (web + mobile)", () => {
    expect(TRACK).toMatch(/today_meals_figma_654/);
    expect(WEB_MEALS).toMatch(/today_meals_figma_654/);
    expect(MOBILE_MEALS).toMatch(/today_meals_figma_654/);
  });
});

describe("single-item card row dedup (ENG-1020 #4 — web + mobile parity)", () => {
  // e2e walk 2026-06-10: the Figma summary card header already shows the
  // single (primary) meal's title + kcal/protein. When a slot has exactly one
  // entry whose title equals that header title, the expanded row repeated it
  // verbatim. The renderSlotExpanded callback in each platform's
  // TodayMealsSection must suppress just that redundant row (keep Add food).
  it("web computes the redundant-single-row guard from the header title", () => {
    expect(WEB_MEALS).toMatch(/redundantSingleRow/);
    expect(WEB_MEALS).toMatch(/sectionMeals\.length === 1/);
    expect(WEB_MEALS).toMatch(/redundantSingleRow \? \[\] : sectionMeals/);
  });

  it("mobile computes the same guard and keeps Add food reachable", () => {
    expect(MOBILE_MEALS).toMatch(/redundantSingleRow/);
    expect(MOBILE_MEALS).toMatch(/meals\.length === 1/);
    expect(MOBILE_MEALS).toMatch(/redundantSingleRow\s*\n?\s*\?\s*null\s*\n?\s*:\s*meals\.map/);
  });
});
