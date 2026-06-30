// @vitest-environment jsdom
/**
 * ENG-790 (2026-05-31) — web `<PlanSourceSelector>` + Plan-tab wiring.
 *
 * Web twin of `apps/mobile/tests/unit/planSourceSelector.test.tsx`. Grace:
 * "give them the option to generate from the discovery pool … plan from
 * library only, library & discovery, only discovery." The presentational
 * three-row radio control renders at the top of the Plan generate form
 * behind `plan_source_selector`; the flag gate + pool wiring live in
 * `src/app/components/MealPlanner.tsx` + `src/context/AppDataContext.tsx`.
 *
 * Part 1 pins the component contract (mirrors mobile, same testIDs/labels
 * so the two platforms can't drift). Part 2 source-pins the web call-site
 * wiring (flag read, `source` threaded into `generateMealPlan`, pool built
 * via the shared helper) so a future refactor can't silently sever it.
 */
import * as React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

import { PlanSourceSelector } from "../../src/app/components/PlanSourceSelector";

void React;

describe("PlanSourceSelector (web, ENG-790)", () => {
  it("renders the three source rows with the right titles and counts", () => {
    const { getByText, getByLabelText } = render(
      <PlanSourceSelector
        mode="library_and_discovery"
        onChange={vi.fn()}
        libraryCount={2}
        discoverCount={5}
      />,
    );
    expect(getByText("My library")).toBeTruthy();
    expect(getByText("Library & discovery")).toBeTruthy();
    expect(getByText("Discovery only")).toBeTruthy();
    // counts: library=2, combined=2+5=7, discovery=5
    expect(getByLabelText("My library, 2 recipes")).toBeTruthy();
    expect(getByLabelText("Library & discovery, 7 recipes")).toBeTruthy();
    expect(getByLabelText("Discovery only, 5 recipes")).toBeTruthy();
  });

  it("marks the row matching `mode` as the selected radio", () => {
    const { getByTestId } = render(
      <PlanSourceSelector
        mode="discovery"
        onChange={vi.fn()}
        libraryCount={3}
        discoverCount={4}
      />,
    );
    expect(getByTestId("plan-source-row-discovery").getAttribute("aria-checked")).toBe("true");
    expect(getByTestId("plan-source-row-library").getAttribute("aria-checked")).toBe("false");
    expect(
      getByTestId("plan-source-row-library_and_discovery").getAttribute("aria-checked"),
    ).toBe("false");
  });

  it("reports the tapped mode via onChange", () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      <PlanSourceSelector
        mode="library_and_discovery"
        onChange={onChange}
        libraryCount={2}
        discoverCount={5}
      />,
    );
    fireEvent.click(getByTestId("plan-source-row-discovery"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("discovery");
  });

  it("singularises the accessibility label at a count of one", () => {
    const { getByLabelText } = render(
      <PlanSourceSelector
        mode="library"
        onChange={vi.fn()}
        libraryCount={1}
        discoverCount={0}
      />,
    );
    expect(getByLabelText("My library, 1 recipe")).toBeTruthy();
  });

  it("falls back to the empty subtitle when a pool has no recipes", () => {
    const { getByText, queryByText } = render(
      <PlanSourceSelector
        mode="library_and_discovery"
        onChange={vi.fn()}
        libraryCount={0}
        discoverCount={3}
      />,
    );
    // library pool empty → emptySubtitle, not the populated subtitle
    expect(getByText("Save a recipe to use this")).toBeTruthy();
    expect(queryByText("Only recipes you've saved")).toBeNull();
  });
});

describe("Plan-tab source wiring (web, ENG-790)", () => {
  const MEALPLANNER_SRC = readFileSync(
    resolve(__dirname, "../../src/app/components/MealPlanner.tsx"),
    "utf8",
  );
  const APPDATA_SRC = readFileSync(
    resolve(__dirname, "../../src/context/AppDataContext.tsx"),
    "utf8",
  );

  it("MealPlanner reads the plan_source_selector flag", () => {
    expect(MEALPLANNER_SRC).toContain('isFeatureEnabled("plan_source_selector")');
  });

  it("MealPlanner threads the chosen source into generateMealPlan", () => {
    // 2026-06-29 (ENG-1261): the regenerate path was extracted into
    // `useMealPlanRegenerate`. MealPlanner passes the flag + chosen source
    // into the hook, and the hook threads `source` into generateMealPlan —
    // pinned end-to-end across the two files so the wiring can't be severed.
    expect(MEALPLANNER_SRC).toMatch(/planSourceSelector,\s*\n\s*planSource,/);
    const REGEN_SRC = readFileSync(
      resolve(__dirname, "../../src/app/components/plan/useMealPlanRegenerate.ts"),
      "utf8",
    );
    expect(REGEN_SRC).toContain(
      "...(args.planSourceSelector ? { source: args.planSource } : {})",
    );
    // The Adjust-constraints save path also threads the freshly chosen source.
    expect(MEALPLANNER_SRC).toContain(
      "...(planSourceSelector ? { source: next.source } : {})",
    );
  });

  it("MealPlanner renders the shared selector with both pool counts", () => {
    expect(MEALPLANNER_SRC).toContain("<PlanSourceSelector");
    expect(MEALPLANNER_SRC).toContain("libraryCount={libraryCount}");
    expect(MEALPLANNER_SRC).toContain("discoverCount={discoverCount}");
  });

  it("AppDataContext builds the pool through the shared helper when a source is set", () => {
    expect(APPDATA_SRC).toContain("if (options?.source)");
    expect(APPDATA_SRC).toContain("selectPlanPool(options.source");
    expect(APPDATA_SRC).toContain("canGenerateFromSource(options.source");
    // the generate call + telemetry read the resolved pool, not raw saves
    expect(APPDATA_SRC).toContain("savedRecipes: pool,");
    expect(APPDATA_SRC).toContain("poolSize: pool.length");
  });
});
