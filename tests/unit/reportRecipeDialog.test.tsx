// @vitest-environment jsdom
/**
 * ReportRecipeDialog (ENG-1225 #19) — routing + the durable report queue.
 * Copyright → the DMCA form (`/dmca?recipe=`); everything else → a describe
 * step → POST /api/recipe-report (the OSA/DSA logged queue) → acknowledgement.
 * Guards the legal-reviewed copy.
 */
import * as React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ReportRecipeDialog", () => {
  it("routes a copyright report to the pre-filled DMCA form and closes", () => {
    const { navigate, onOpenChange, getByTestId } = setup();
    fireEvent.click(getByTestId("report-reason-copyright"));
    expect(navigate).toHaveBeenCalledWith("/dmca?recipe=r_demo_123");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("logs a non-copyright report to the durable queue + acknowledges", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const { getByTestId, queryByTestId } = setup();

    fireEvent.click(getByTestId("report-reason-unsafe"));
    // Describe step
    fireEvent.change(getByTestId("report-description"), { target: { value: "raw chicken step" } });
    fireEvent.click(getByTestId("report-submit"));

    await waitFor(() => expect(queryByTestId("report-done")).not.toBeNull());
    // ENG-1226: the endpoint is authenticated; the same-origin request must
    // carry credentials so the Supabase auth cookie reaches the server.
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/recipe-report",
      expect.objectContaining({ method: "POST", credentials: "same-origin" }),
    );
    const sentBody = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(sentBody).toMatchObject({ recipeId: "r_demo_123", reason: "unsafe", description: "raw chicken step" });
  });

  it("falls back to an email channel when the queue POST fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 500 }));
    const { getByTestId, baseElement } = setup();
    fireEvent.click(getByTestId("report-reason-incorrect"));
    fireEvent.click(getByTestId("report-submit"));
    await waitFor(() => expect(baseElement.textContent).toContain("support@getsloe.com"));
  });

  it("uses legally-reviewed copy (no 'own this recipe', no guaranteed takedown)", () => {
    const { baseElement } = setup();
    const text = baseElement.textContent ?? "";
    expect(text).toContain("Copyright — this is my content");
    expect(text).not.toContain("I own this recipe");
    expect(text).toContain("Starts a copyright takedown request");
  });
});
