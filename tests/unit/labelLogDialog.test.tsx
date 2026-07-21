import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const trackMock = vi.fn();
vi.mock("../../src/lib/analytics/track", () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

import { LabelLogDialog } from "../../src/app/components/suppr/label-log-dialog";

describe("LabelLogDialog", () => {
  beforeEach(() => {
    trackMock.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: true,
            name: "Greek yoghurt",
            servingSizeG: 50,
            calories: 200,
            protein: 20,
            carbs: 12,
            fat: 8,
            confidence: "high",
            implausible: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
  });

  it("captures, scales, lets the user correct, and commits one reviewed serving", async () => {
    const onCommit = vi.fn(async () => undefined);
    render(
      <LabelLogDialog
        open
        onOpenChange={() => {}}
        activeSlot="Lunch"
        onCommit={onCommit}
      />,
    );

    fireEvent.change(screen.getByTestId("label-log-file-input"), {
      target: { files: [new File(["image"], "label.jpg", { type: "image/jpeg" })] },
    });

    await waitFor(() => expect(screen.getByText("Check the label")).toBeTruthy());
    expect(screen.getByLabelText("Calories")).toHaveValue(100);
    expect(screen.getByLabelText("Protein (g)")).toHaveValue(10);

    fireEvent.change(screen.getByLabelText("Food name"), {
      target: { value: "Corrected yoghurt" },
    });
    fireEvent.change(screen.getByLabelText("Calories"), { target: { value: "105" } });
    fireEvent.click(screen.getByTestId("label-log-commit"));

    await waitFor(() => expect(onCommit).toHaveBeenCalledTimes(1));
    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Corrected yoghurt",
        servingSizeG: 50,
        calories: 105,
        protein: 10,
        carbs: 6,
        fat: 4,
        confidence: "high",
      }),
    );
    expect(trackMock).toHaveBeenCalledWith(
      "nutrition_label_log_parsed",
      expect.objectContaining({ platform: "web", confidence: "high" }),
    );
  });

  it("returns to capture with a visible error when parsing fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: false, message: "Label is too blurry." }), {
          status: 422,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    render(
      <LabelLogDialog
        open
        onOpenChange={() => {}}
        activeSlot="Lunch"
        onCommit={() => {}}
      />,
    );
    fireEvent.change(screen.getByTestId("label-log-file-input"), {
      target: { files: [new File(["image"], "label.jpg", { type: "image/jpeg" })] },
    });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Label is too blurry."));
    expect(screen.getByTestId("label-log-capture")).toBeTruthy();
  });
});
