import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { CancelExportPromptDialog } from "../../src/app/components/suppr/cancel-export-prompt-dialog";

void React;

/**
 * CancelExportPromptDialog (web) — journey-architect P1 (2026-05-01) close.
 *
 * Mobile parity: `apps/mobile/components/settings/CancelExportPromptSheet.tsx`
 * (smoke-rendered in `apps/mobile/tests/unit/cancelExportPromptSheet.test.tsx`).
 *
 * Behaviour pinned here:
 *   - `open=false` renders nothing.
 *   - `open=true` renders both equal-weight cards.
 *   - Each card invokes its host callback.
 *   - X button invokes onDismiss.
 *   - Backdrop click invokes onDismiss.
 */

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

  it("renders both equal-weight cards when open=true", () => {
    render(
      <CancelExportPromptDialog
        open
        onDismiss={vi.fn()}
        onExport={vi.fn()}
        onContinueToManage={vi.fn()}
      />,
    );
    expect(screen.getByTestId("cancel-export-prompt-dialog")).toBeDefined();
    expect(screen.getByText("Take your data with you")).toBeDefined();
    expect(screen.getByText("Continue to manage")).toBeDefined();
  });

  it("Take your data with you click fires onExport exactly once", () => {
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

  it("Continue to manage click fires onContinueToManage exactly once", () => {
    const onContinue = vi.fn();
    render(
      <CancelExportPromptDialog
        open
        onDismiss={vi.fn()}
        onExport={vi.fn()}
        onContinueToManage={onContinue}
      />,
    );
    fireEvent.click(screen.getByTestId("cancel-export-prompt-continue"));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("close button fires onDismiss exactly once", () => {
    const onDismiss = vi.fn();
    render(
      <CancelExportPromptDialog
        open
        onDismiss={onDismiss}
        onExport={vi.fn()}
        onContinueToManage={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("backdrop click (outside the card) fires onDismiss", () => {
    const onDismiss = vi.fn();
    render(
      <CancelExportPromptDialog
        open
        onDismiss={onDismiss}
        onExport={vi.fn()}
        onContinueToManage={vi.fn()}
      />,
    );
    const backdrop = screen.getByTestId("cancel-export-prompt-dialog");
    // Click directly on the dialog wrapper (not propagating from the
    // inner card) — host treats this as a backdrop click.
    fireEvent.click(backdrop, { target: backdrop });
    expect(onDismiss).toHaveBeenCalled();
  });
});
