// @vitest-environment jsdom
/**
 * CancelExportPromptSheet — rebuilds stale PR #43 on top of current
 * main (2026-05-02). Closes journey-architect P1: pre-rebuild the
 * CSV-export prompt was buried 4-5 taps deep in Settings; tapping
 * "Manage subscription" routed straight to RC's customerCenter
 * without surfacing the option. The sheet now appears between the
 * cancel touchpoint and the RC handoff so export is proactive.
 *
 * Posture pinned by these tests: equal-weight CTAs (no
 * "highlighted primary"), no retention-via-friction, sheet stays
 * open on export success.
 *
 * 5 tests:
 *   1. Equal-weight rendering — both cards render with identical
 *      structural fingerprint (no privileged primary CTA).
 *   2. Single-fire export CTA — one tap fires `onExport` exactly
 *      once.
 *   3. Success-state row count — when `exporting=true` the sheet
 *      still shows BOTH cards (sheet stays open after export tap).
 *   4. Close-vs-continue intent separation — close X invokes
 *      `onDismiss`; "Continue to manage" invokes
 *      `onContinueToManage` and they are mutually exclusive.
 *   5. Null-export resilience — host can render the sheet even if
 *      `onExport` is a no-op (no error throws, no crash). Pins the
 *      contract: the sheet itself never reads from / depends on the
 *      export pipeline.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

import { CancelExportPromptSheet } from "../../components/settings/CancelExportPromptSheet";

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#000",
    textSecondary: "#555",
    textTertiary: "#888",
    background: "#fff",
    card: "#fff",
    cardBorder: "#eee",
    border: "#eee",
    accent: "#22c55e",
  }),
}));

void React;

describe("CancelExportPromptSheet (mobile)", () => {
  it("renders BOTH cards with equal-weight visual fingerprint when visible", () => {
    const { getByTestId, getByText, queryAllByText } = render(
      <CancelExportPromptSheet
        visible
        onDismiss={vi.fn()}
        onExport={vi.fn()}
        onContinueToManage={vi.fn()}
      />,
    );
    expect(getByTestId("cancel-export-prompt-sheet")).toBeTruthy();
    // Both cards present.
    const exportCard = getByTestId("cancel-export-prompt-export");
    const continueCard = getByTestId("cancel-export-prompt-continue");
    expect(exportCard).toBeTruthy();
    expect(continueCard).toBeTruthy();
    // Equal-weight visual fingerprint: same border colour, same
    // background colour, same border width on both cards. The user
    // is mid-cancel; we are not retention-engineering by privileging
    // "stay" over "go" with a tinted primary card.
    const flat = (s: unknown): Record<string, unknown> => {
      if (Array.isArray(s)) {
        return s.reduce<Record<string, unknown>>(
          (acc, x) => ({ ...acc, ...(flat(x) as Record<string, unknown>) }),
          {},
        );
      }
      return (s ?? {}) as Record<string, unknown>;
    };
    const exportStyle = flat(exportCard.props.style);
    const continueStyle = flat(continueCard.props.style);
    expect(exportStyle.borderColor).toBe(continueStyle.borderColor);
    expect(exportStyle.backgroundColor).toBe(continueStyle.backgroundColor);
    expect(exportStyle.borderWidth).toBe(continueStyle.borderWidth);
    // Title copy of both cards renders.
    expect(getByText("Take your data with you")).toBeTruthy();
    expect(getByText("Continue to manage")).toBeTruthy();
    // Sheet itself surfaces "Before you go" header exactly once.
    expect(queryAllByText("Before you go")).toHaveLength(1);
  });

  it("'Take your data with you' tap fires onExport exactly once (single-fire)", () => {
    const onExport = vi.fn();
    const { getByTestId } = render(
      <CancelExportPromptSheet
        visible
        onDismiss={vi.fn()}
        onExport={onExport}
        onContinueToManage={vi.fn()}
      />,
    );
    fireEvent.press(getByTestId("cancel-export-prompt-export"));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it("renders BOTH cards when exporting=true (sheet stays open after export tap)", () => {
    // Posture pin: "Take your data with you" must NOT auto-dismiss
    // the sheet on success. The user can still tap "Continue to
    // manage" or close manually. With `exporting=true` the export
    // card is disabled but both cards still render.
    const { getByTestId, getByText } = render(
      <CancelExportPromptSheet
        visible
        exporting
        onDismiss={vi.fn()}
        onExport={vi.fn()}
        onContinueToManage={vi.fn()}
      />,
    );
    expect(getByTestId("cancel-export-prompt-sheet")).toBeTruthy();
    expect(getByTestId("cancel-export-prompt-export")).toBeTruthy();
    expect(getByTestId("cancel-export-prompt-continue")).toBeTruthy();
    // Preparing-state copy lives under the export card during export.
    expect(getByText("Preparing your file…")).toBeTruthy();
  });

  it("close X and 'Continue to manage' route to distinct callbacks (intent separation)", () => {
    const onDismiss = vi.fn();
    const onContinueToManage = vi.fn();
    const onExport = vi.fn();
    const { getByLabelText, getByTestId } = render(
      <CancelExportPromptSheet
        visible
        onDismiss={onDismiss}
        onExport={onExport}
        onContinueToManage={onContinueToManage}
      />,
    );
    fireEvent.press(getByLabelText("Close"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onContinueToManage).not.toHaveBeenCalled();
    expect(onExport).not.toHaveBeenCalled();

    fireEvent.press(getByTestId("cancel-export-prompt-continue"));
    expect(onContinueToManage).toHaveBeenCalledTimes(1);
    // Close was already counted once above; intent for the continue
    // tap is NOT to fire onDismiss (the host owns dismissal post-route).
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onExport).not.toHaveBeenCalled();
  });

  it("renders cleanly when onExport is a no-op (null-export resilience)", () => {
    // The sheet itself is decoupled from the export pipeline — it
    // never reads CSV bytes, never inspects the result, never gates
    // on success. The host can pass an effectively-null `onExport`
    // (e.g. when `nutritionLogToCsv` returns no data) and the sheet
    // must still render and respond to the close + continue paths
    // without throwing.
    const noopExport = vi.fn();
    const onContinue = vi.fn();
    const onDismiss = vi.fn();
    expect(() =>
      render(
        <CancelExportPromptSheet
          visible
          onDismiss={onDismiss}
          onExport={noopExport}
          onContinueToManage={onContinue}
        />,
      ),
    ).not.toThrow();
    const { getByTestId } = render(
      <CancelExportPromptSheet
        visible
        onDismiss={onDismiss}
        onExport={noopExport}
        onContinueToManage={onContinue}
      />,
    );
    // Tapping export with the noop must not crash.
    expect(() =>
      fireEvent.press(getByTestId("cancel-export-prompt-export")),
    ).not.toThrow();
    // Sheet still navigable.
    expect(() =>
      fireEvent.press(getByTestId("cancel-export-prompt-continue")),
    ).not.toThrow();
  });
});
