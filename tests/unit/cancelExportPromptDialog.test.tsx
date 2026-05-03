// @vitest-environment jsdom
/**
 * CancelExportPromptDialog (web) — rebuilds stale PR #43 on top of
 * current main (2026-05-02). Mobile parity at
 * `apps/mobile/components/settings/CancelExportPromptSheet.tsx`
 * (covered by `apps/mobile/tests/unit/cancelExportPromptSheet.test.tsx`).
 *
 * 6 tests:
 *   1. open=false renders nothing.
 *   2. Equal-weight rendering when open=true (both cards present
 *      with identical structural fingerprint).
 *   3. "Take your data with you" click fires onExport exactly once.
 *   4. "Continue to manage" click fires onContinueToManage exactly
 *      once + close X fires onDismiss (intent separation, mirrors
 *      mobile #4).
 *   5. Backdrop click fires onDismiss; Null-export resilience
 *      (noop onExport doesn't crash).
 *   6. State-reset on close/re-open — exporting state from a previous
 *      open does not bleed into the next render.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { CancelExportPromptDialog } from "../../src/app/components/suppr/cancel-export-prompt-dialog";

void React;

describe("CancelExportPromptDialog (web)", () => {
  it("renders nothing when open=false", () => {
    render(
      <CancelExportPromptDialog
        open={false}
        onDismiss={vi.fn()}
        onExport={vi.fn()}
        onContinueToManage={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("cancel-export-prompt-dialog")).toBeNull();
  });

  it("renders BOTH cards with equal-weight fingerprint when open=true", () => {
    render(
      <CancelExportPromptDialog
        open
        onDismiss={vi.fn()}
        onExport={vi.fn()}
        onContinueToManage={vi.fn()}
      />,
    );
    expect(screen.getByTestId("cancel-export-prompt-dialog")).toBeDefined();
    const exportBtn = screen.getByTestId("cancel-export-prompt-export");
    const continueBtn = screen.getByTestId("cancel-export-prompt-continue");
    expect(exportBtn).toBeDefined();
    expect(continueBtn).toBeDefined();
    // Equal-weight fingerprint: both cards share the same set of
    // utility classes for border, background, and hover treatment.
    // The user is mid-cancel; we are not retention-engineering by
    // visually privileging "stay" over "go".
    const exportClasses = (exportBtn.className ?? "").split(/\s+/);
    const continueClasses = (continueBtn.className ?? "").split(/\s+/);
    for (const cls of [
      "border",
      "border-border",
      "bg-background",
      "hover:bg-muted/40",
    ]) {
      expect(exportClasses).toContain(cls);
      expect(continueClasses).toContain(cls);
    }
    // No tinted-primary classes on either card (no "highlighted CTA").
    expect(exportClasses).not.toContain("border-primary");
    expect(exportClasses).not.toContain("bg-primary/10");
    expect(continueClasses).not.toContain("border-primary");
    expect(continueClasses).not.toContain("bg-primary/10");
    // Title copy renders.
    expect(screen.getByText("Take your data with you")).toBeDefined();
    expect(screen.getByText("Continue to manage")).toBeDefined();
  });

  it("'Take your data with you' click fires onExport exactly once", () => {
    const onExport = vi.fn();
    render(
      <CancelExportPromptDialog
        open
        onDismiss={vi.fn()}
        onExport={onExport}
        onContinueToManage={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("cancel-export-prompt-export"));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it("close X and 'Continue to manage' route to distinct callbacks", () => {
    const onDismiss = vi.fn();
    const onContinue = vi.fn();
    const onExport = vi.fn();
    render(
      <CancelExportPromptDialog
        open
        onDismiss={onDismiss}
        onExport={onExport}
        onContinueToManage={onContinue}
      />,
    );
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onContinue).not.toHaveBeenCalled();
    expect(onExport).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("cancel-export-prompt-continue"));
    expect(onContinue).toHaveBeenCalledTimes(1);
    // The continue path does NOT itself fire onDismiss — the host
    // owns dismissal post-route. close X count stays at 1.
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onExport).not.toHaveBeenCalled();
  });

  it("backdrop click fires onDismiss; null-export onExport doesn't crash", () => {
    const onDismiss = vi.fn();
    const noopExport = vi.fn();
    const { unmount } = render(
      <CancelExportPromptDialog
        open
        onDismiss={onDismiss}
        onExport={noopExport}
        onContinueToManage={vi.fn()}
      />,
    );
    const dialog = screen.getByTestId("cancel-export-prompt-dialog");
    // Click directly on the dialog wrapper (the backdrop). The card
    // body uses stopPropagation; only direct backdrop clicks dismiss.
    fireEvent.click(dialog, { target: dialog });
    expect(onDismiss).toHaveBeenCalled();
    // Null-export resilience: tapping the export CTA with a noop
    // must not throw — the dialog itself is decoupled from the
    // export pipeline.
    expect(() =>
      fireEvent.click(screen.getByTestId("cancel-export-prompt-export")),
    ).not.toThrow();
    unmount();
  });

  it("state-reset on close/re-open — exporting flag from a prior open does not bleed", () => {
    // Re-rendering the dialog with `open=false` then `open=true` and
    // `exporting=false` must produce a clean enabled export card.
    // The host owns the `exporting` state and resets it on close;
    // this test pins that the dialog correctly reflects whatever
    // `exporting` value the host passes on each render — there is no
    // hidden internal state that survives a close/re-open cycle.
    const { rerender } = render(
      <CancelExportPromptDialog
        open
        exporting
        onDismiss={vi.fn()}
        onExport={vi.fn()}
        onContinueToManage={vi.fn()}
      />,
    );
    // First render: exporting=true → export card disabled.
    let exportBtn = screen.getByTestId(
      "cancel-export-prompt-export",
    ) as HTMLButtonElement;
    expect(exportBtn.disabled).toBe(true);
    expect(screen.getByText("Preparing your file…")).toBeDefined();

    // Close the dialog (host resets state).
    rerender(
      <CancelExportPromptDialog
        open={false}
        exporting={false}
        onDismiss={vi.fn()}
        onExport={vi.fn()}
        onContinueToManage={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("cancel-export-prompt-dialog")).toBeNull();

    // Re-open with exporting=false. The export card must be enabled.
    rerender(
      <CancelExportPromptDialog
        open
        exporting={false}
        onDismiss={vi.fn()}
        onExport={vi.fn()}
        onContinueToManage={vi.fn()}
      />,
    );
    exportBtn = screen.getByTestId(
      "cancel-export-prompt-export",
    ) as HTMLButtonElement;
    expect(exportBtn.disabled).toBe(false);
    // Default sub copy returns; no leaked "Preparing your file…".
    expect(screen.queryByText("Preparing your file…")).toBeNull();
    expect(
      screen.getByText(
        "Export your nutrition log as a CSV before any change.",
      ),
    ).toBeDefined();
  });
});
