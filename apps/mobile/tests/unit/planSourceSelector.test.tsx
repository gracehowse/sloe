// @vitest-environment jsdom
/**
 * ENG-790 (2026-05-31) — `<PlanSourceSelector>` unit coverage.
 *
 * Grace: "give them the option to generate from the discovery pool … we
 * should probably always give these options — plan from library only,
 * library & discovery, only discovery." This is the presentational
 * three-row radio control rendered at the top of the Plan generate form
 * behind `plan_source_selector`. The flag gate + pool wiring live in
 * `app/(tabs)/planner.tsx`; here we pin the component contract:
 *
 *   1. Renders all three source rows with live pool counts.
 *   2. The `mode` prop drives the selected radio.
 *   3. Tapping a row reports that mode via `onChange`.
 *   4. An empty pool swaps to the row's `emptySubtitle`.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

import { PlanSourceSelector } from "../../components/plan/PlanSourceSelector";

void React;

describe("PlanSourceSelector (ENG-790)", () => {
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
    expect(getByTestId("plan-source-row-discovery").props.accessibilityState?.selected).toBe(true);
    expect(getByTestId("plan-source-row-library").props.accessibilityState?.selected).toBe(false);
    expect(
      getByTestId("plan-source-row-library_and_discovery").props.accessibilityState?.selected,
    ).toBe(false);
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
    fireEvent.press(getByTestId("plan-source-row-discovery"));
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
