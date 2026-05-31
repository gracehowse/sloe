// @vitest-environment jsdom
/**
 * ENG-788 (2026-05-30) — `<PlanEmptyState>` unit coverage.
 *
 * Grace: "I dont know what happened here but it looks terrible." This is
 * the calm 0-recipe Plan empty state shown behind `plan_empty_state_v2`
 * in place of the old config form that dead-ended in a disabled Generate
 * button. The flag gate itself lives in `app/(tabs)/planner.tsx`; here we
 * pin the presentational contract of the extracted component:
 *
 *   1. Renders the title + a solid, ENABLED "Browse recipe library" CTA.
 *   2. Tapping the CTA calls `onBrowseLibrary` (the un-blocking action).
 *   3. The import affordance is hidden when `planImportEnabled` is false…
 *   4. …and shown + wired to `onImport` when true.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

import { PlanEmptyState } from "../../components/PlanEmptyState";

void React;

describe("PlanEmptyState (ENG-788)", () => {
  it("renders the calm title and an enabled Browse recipe library CTA", () => {
    const { getByText, getByLabelText } = render(
      <PlanEmptyState onBrowseLibrary={vi.fn()} planImportEnabled={false} onImport={vi.fn()} />,
    );
    expect(getByText("Add a few recipes first")).toBeTruthy();
    const cta = getByLabelText("Browse recipe library");
    // No `disabled`/`aria-disabled` — this CTA is always actionable, the
    // whole point of the fix (the old Generate button was dead at 0 saved).
    expect(cta.props.accessibilityState?.disabled).toBeFalsy();
  });

  it("calls onBrowseLibrary when the primary CTA is pressed", () => {
    const onBrowseLibrary = vi.fn();
    const { getByLabelText } = render(
      <PlanEmptyState
        onBrowseLibrary={onBrowseLibrary}
        planImportEnabled={false}
        onImport={vi.fn()}
      />,
    );
    fireEvent.press(getByLabelText("Browse recipe library"));
    expect(onBrowseLibrary).toHaveBeenCalledTimes(1);
  });

  it("hides the import affordance when planImportEnabled is false", () => {
    const { queryByLabelText } = render(
      <PlanEmptyState onBrowseLibrary={vi.fn()} planImportEnabled={false} onImport={vi.fn()} />,
    );
    expect(queryByLabelText("Import existing meal plan")).toBeNull();
  });

  it("shows the import affordance and wires onImport when planImportEnabled is true", () => {
    const onImport = vi.fn();
    const { getByLabelText } = render(
      <PlanEmptyState onBrowseLibrary={vi.fn()} planImportEnabled={true} onImport={onImport} />,
    );
    const importBtn = getByLabelText("Import existing meal plan");
    expect(importBtn).toBeTruthy();
    fireEvent.press(importBtn);
    expect(onImport).toHaveBeenCalledTimes(1);
  });
});
