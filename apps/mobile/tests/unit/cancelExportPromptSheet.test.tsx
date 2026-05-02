// @vitest-environment jsdom
/**
 * CancelExportPromptSheet — journey-architect P1 (2026-05-01) close.
 *
 * Pre-2026-05-01 the CSV export was buried 4-5 taps deep in Settings;
 * a user who tapped "Manage subscription" and cancelled never saw the
 * export prompt. This sheet surfaces between the cancel touchpoint
 * and the RC handoff so export is proactive, not reactive.
 *
 * Behaviour pinned here:
 *   - `visible=false` renders nothing.
 *   - `visible=true` renders both equal-weight cards.
 *   - "Take your data with you" tap fires `onExport`.
 *   - "Continue to manage" tap fires `onContinueToManage`.
 *   - X button fires `onDismiss`.
 *
 * The host-side gate (only renders when "Manage subscription" is
 * tapped) is exercised at the integration level on the settings
 * screen.
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
  }),
}));

void React;

describe("CancelExportPromptSheet (mobile)", () => {
  it("renders nothing when visible=false", () => {
    const { queryByTestId } = render(
      <CancelExportPromptSheet
        visible={false}
        onDismiss={vi.fn()}
        onExport={vi.fn()}
        onContinueToManage={vi.fn()}
      />,
    );
    expect(queryByTestId("cancel-export-prompt-sheet")).toBeNull();
  });

  it("renders both equal-weight cards when visible=true", () => {
    const { getByTestId, getByText } = render(
      <CancelExportPromptSheet
        visible
        onDismiss={vi.fn()}
        onExport={vi.fn()}
        onContinueToManage={vi.fn()}
      />,
    );
    expect(getByTestId("cancel-export-prompt-sheet")).toBeTruthy();
    expect(getByText("Take your data with you")).toBeTruthy();
    expect(getByText("Continue to manage")).toBeTruthy();
  });

  it("Take your data with you tap fires onExport exactly once", () => {
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

  it("Continue to manage tap fires onContinueToManage exactly once", () => {
    const onContinue = vi.fn();
    const { getByTestId } = render(
      <CancelExportPromptSheet
        visible
        onDismiss={vi.fn()}
        onExport={vi.fn()}
        onContinueToManage={onContinue}
      />,
    );
    fireEvent.press(getByTestId("cancel-export-prompt-continue"));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("close X tap fires onDismiss exactly once", () => {
    const onDismiss = vi.fn();
    const { getByLabelText } = render(
      <CancelExportPromptSheet
        visible
        onDismiss={onDismiss}
        onExport={vi.fn()}
        onContinueToManage={vi.fn()}
      />,
    );
    fireEvent.press(getByLabelText("Close"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
