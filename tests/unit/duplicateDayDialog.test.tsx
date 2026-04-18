/**
 * DuplicateDayDialog render test (M11 audit, 2026-04-18).
 *
 * Covers the F2 backlog row for the day-level duplicate sheet. Mounts
 * the dialog and asserts:
 *  - single-day mode with the default target (source +1) fires onConfirm
 *    with exactly [source+1]
 *  - date-range mode expands inclusively and excludes the source day
 *  - picking a reversed range returns [] and disables confirm
 *  - sourceMealCount === 0 disables confirm entirely (nothing to copy)
 *  - changing the single-day target away from the default works
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DuplicateDayDialog } from "../../src/app/components/suppr/duplicate-day-dialog";

void React;

function Harness({
  sourceDayKey,
  sourceMealCount,
  onConfirm,
}: {
  sourceDayKey: string;
  sourceMealCount: number;
  onConfirm: (keys: string[], summary: string) => void;
}) {
  const [open, setOpen] = React.useState(true);
  return (
    <DuplicateDayDialog
      open={open}
      onOpenChange={setOpen}
      sourceDayKey={sourceDayKey}
      sourceMealCount={sourceMealCount}
      onConfirm={(keys, summary) => {
        onConfirm(keys, summary);
        setOpen(false);
      }}
    />
  );
}

describe("DuplicateDayDialog (F2)", () => {
  it("defaults to single-day mode, target = source +1, and confirms with just that day", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness sourceDayKey="2026-04-17" sourceMealCount={3} onConfirm={onConfirm} />);

    // Single-day tab active by default.
    expect(screen.getByRole("tab", { name: /single day/i })).toHaveAttribute("aria-selected", "true");
    // Source meal count echoed in the header.
    expect(screen.getByText(/3 meals from/i)).toBeInTheDocument();

    const targetInput = screen.getByLabelText(/target day/i) as HTMLInputElement;
    expect(targetInput.value).toBe("2026-04-18");

    await user.click(screen.getByRole("button", { name: /^duplicate$/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0]).toEqual(["2026-04-18"]);
  });

  it("expands a date range inclusively and excludes the source day", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness sourceDayKey="2026-04-17" sourceMealCount={2} onConfirm={onConfirm} />);

    await user.click(screen.getByRole("tab", { name: /date range/i }));
    expect(screen.getByRole("tab", { name: /date range/i })).toHaveAttribute("aria-selected", "true");

    const startInput = screen.getByLabelText(/range start/i) as HTMLInputElement;
    const endInput = screen.getByLabelText(/range end/i) as HTMLInputElement;
    // Change start + end so the source sits inside the range and we can
    // verify it gets excluded automatically.
    fireEvent.change(startInput, { target: { value: "2026-04-16" } });
    fireEvent.change(endInput, { target: { value: "2026-04-19" } });

    await user.click(screen.getByRole("button", { name: /^duplicate$/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    // Source 2026-04-17 must be excluded from the expanded range.
    expect(onConfirm.mock.calls[0][0]).toEqual([
      "2026-04-16",
      "2026-04-18",
      "2026-04-19",
    ]);
  });

  it("disables confirm for a reversed range (end before start)", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness sourceDayKey="2026-04-17" sourceMealCount={2} onConfirm={onConfirm} />);

    await user.click(screen.getByRole("tab", { name: /date range/i }));
    const startInput = screen.getByLabelText(/range start/i) as HTMLInputElement;
    const endInput = screen.getByLabelText(/range end/i) as HTMLInputElement;
    fireEvent.change(startInput, { target: { value: "2026-04-25" } });
    fireEvent.change(endInput, { target: { value: "2026-04-20" } });

    const btn = screen.getByRole("button", { name: /^duplicate$/i });
    expect(btn).toBeDisabled();
    await user.click(btn);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("disables confirm and shows the empty-source copy when sourceMealCount is 0", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness sourceDayKey="2026-04-17" sourceMealCount={0} onConfirm={onConfirm} />);

    // The empty-source copy surfaces in both the dialog description and
    // the live-polite hint, so `getAllByText` is the stable assertion.
    expect(screen.getAllByText(/this day has no meals/i).length).toBeGreaterThanOrEqual(1);
    const btn = screen.getByRole("button", { name: /^duplicate$/i });
    expect(btn).toBeDisabled();
    await user.click(btn);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("lets the user pick a custom single-day target", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness sourceDayKey="2026-04-17" sourceMealCount={1} onConfirm={onConfirm} />);

    const targetInput = screen.getByLabelText(/target day/i) as HTMLInputElement;
    fireEvent.change(targetInput, { target: { value: "2026-05-01" } });

    await user.click(screen.getByRole("button", { name: /^duplicate$/i }));
    expect(onConfirm).toHaveBeenCalledWith(
      ["2026-05-01"],
      expect.stringMatching(/Duplicated to/i),
    );
  });
});
