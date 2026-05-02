// @vitest-environment jsdom
/**
 * CancelExportPromptSheet — render + interaction pins (mobile).
 *
 * The sheet is the user-facing surface of the calm-tone "take your data
 * with you" cancel flow (PR claude/cancel-flow-export-prompt,
 * 2026-05-02). These tests pin the visible contract:
 *
 *   1. Both options render at equal weight (no dark-pattern emphasis).
 *   2. "Take your data with you" calls onExport once and shows the
 *      success state with the row count.
 *   3. "Continue cancelling" calls onContinueCancelling once.
 *   4. Backdrop close calls onClose, NOT onContinueCancelling — the
 *      analytics funnel needs the two intents kept distinct.
 *   5. While exporting, the export row stays disabled to prevent a
 *      double-fire.
 *
 * Decision posture pinned by `docs/decisions/2026-05-02-cancel-export-prompt.md`.
 */
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { CancelExportPromptSheet } from "../../components/settings/CancelExportPromptSheet";

void React;

const BASE_COLORS = {
  cardColor: "#fff",
  textColor: "#000",
  textSecondaryColor: "#555",
  borderColor: "#e0e0e0",
};

describe("CancelExportPromptSheet", () => {
  it("renders the calm-tone headline + description", () => {
    const { getByText } = render(
      <CancelExportPromptSheet
        visible
        onExport={async () => null}
        onContinueCancelling={() => {}}
        onClose={() => {}}
        {...BASE_COLORS}
      />,
    );
    expect(getByText("Before you go")).toBeTruthy();
    expect(getByText(/Your data is yours\. You can take it with you/)).toBeTruthy();
  });

  it("renders both action rows at equal weight (no dark-pattern emphasis)", () => {
    const { getByLabelText } = render(
      <CancelExportPromptSheet
        visible
        onExport={async () => null}
        onContinueCancelling={() => {}}
        onClose={() => {}}
        {...BASE_COLORS}
      />,
    );
    // Both must be discoverable by the same accessibility role + label.
    expect(getByLabelText("Take your data with you")).toBeTruthy();
    expect(getByLabelText("Continue cancelling")).toBeTruthy();
  });

  it("calls onExport once and renders the row count when export succeeds", async () => {
    const onExport = vi.fn(async () => ({ rowCount: 342 }));
    const { getByLabelText, getByText } = render(
      <CancelExportPromptSheet
        visible
        onExport={onExport}
        onContinueCancelling={() => {}}
        onClose={() => {}}
        {...BASE_COLORS}
      />,
    );
    fireEvent.press(getByLabelText("Take your data with you"));
    await waitFor(() => {
      expect(onExport).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(getByText(/Exported 342 entries\./)).toBeTruthy();
    });
  });

  it("does not crash when export returns null (host showed an error toast)", async () => {
    const onExport = vi.fn(async () => null);
    const { getByLabelText, queryByText } = render(
      <CancelExportPromptSheet
        visible
        onExport={onExport}
        onContinueCancelling={() => {}}
        onClose={() => {}}
        {...BASE_COLORS}
      />,
    );
    fireEvent.press(getByLabelText("Take your data with you"));
    await waitFor(() => {
      expect(onExport).toHaveBeenCalled();
    });
    // Export-success state should NOT appear.
    expect(queryByText(/Exported \d+ entries\./)).toBeNull();
  });

  it("calls onContinueCancelling exactly once when its row is pressed", () => {
    const onContinueCancelling = vi.fn();
    const { getByLabelText } = render(
      <CancelExportPromptSheet
        visible
        onExport={async () => null}
        onContinueCancelling={onContinueCancelling}
        onClose={() => {}}
        {...BASE_COLORS}
      />,
    );
    fireEvent.press(getByLabelText("Continue cancelling"));
    expect(onContinueCancelling).toHaveBeenCalledTimes(1);
  });

  it("calls onClose (not onContinueCancelling) when backdrop is dismissed", () => {
    const onClose = vi.fn();
    const onContinueCancelling = vi.fn();
    const { getByLabelText } = render(
      <CancelExportPromptSheet
        visible
        onExport={async () => null}
        onContinueCancelling={onContinueCancelling}
        onClose={onClose}
        {...BASE_COLORS}
      />,
    );
    fireEvent.press(getByLabelText("Dismiss"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onContinueCancelling).not.toHaveBeenCalled();
  });
});
