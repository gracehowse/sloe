// @vitest-environment jsdom
/**
 * ReportRecipeDialog (ENG-1225 #19) — routing + legal-reviewed copy.
 * Copyright → the DMCA form (`/dmca?recipe=`); everything else → a support
 * mailto with an in-dialog acknowledgement (no silent evaporation). Guards the
 * copy the legal-reviewer required (recipes aren't copyrightable; no guaranteed
 * takedown).
 */
import * as React from "react";
import { render, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReportRecipeDialog } from "../../src/app/components/suppr/report-recipe-dialog";

void React;

function setup() {
  const navigate = vi.fn();
  const onOpenChange = vi.fn();
  const utils = render(
    <ReportRecipeDialog
      open
      onOpenChange={onOpenChange}
      recipeId="r_demo_123"
      recipeTitle="Tahini bowl"
      navigate={navigate}
    />,
  );
  return { navigate, onOpenChange, ...utils };
}

describe("ReportRecipeDialog", () => {
  it("routes a copyright report to the pre-filled DMCA form and closes", () => {
    const { navigate, onOpenChange, getByTestId } = setup();
    fireEvent.click(getByTestId("report-reason-copyright"));
    expect(navigate).toHaveBeenCalledWith("/dmca?recipe=r_demo_123");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("routes a non-copyright report to a support mailto + shows an acknowledgement", () => {
    const { navigate, queryByTestId, getByTestId } = setup();
    fireEvent.click(getByTestId("report-reason-incorrect"));
    const href = navigate.mock.calls[0]?.[0] as string;
    expect(href).toMatch(/^mailto:support@getsloe\.com\?/);
    expect(href).toContain("r_demo_123");
    // Acknowledgement state — the report doesn't silently evaporate.
    expect(queryByTestId("report-done")).not.toBeNull();
  });

  it("uses legally-reviewed copy (no 'own this recipe', no guaranteed takedown)", () => {
    // Radix Dialog portals to document.body — read baseElement, not container.
    const { baseElement } = setup();
    const text = baseElement.textContent ?? "";
    expect(text).toContain("Copyright — this is my content");
    expect(text).not.toContain("I own this recipe");
    expect(text).not.toMatch(/for takedown\./);
    expect(text).toContain("Starts a copyright takedown request");
  });
});
