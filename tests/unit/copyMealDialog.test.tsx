/**
 * CopyMealDialog render test (M11 audit, 2026-04-18; ENG-786 rebuild
 * 2026-07-21 added the meal-slot selector — this dialog now backs BOTH
 * the single-item copy flow and the whole-slot "Copy to another day"
 * flow).
 *
 * Covers the F2 backlog row. Mounts the dialog and asserts:
 *  - opens with the day after source as the default target
 *  - target date input changes the confirm payload
 *  - quick-range chips extend the payload by the chip length, starting
 *    from the chosen primary date
 *  - the source day is always excluded from the payload (even if the
 *    user picks it as the target) UNLESS the target slot also changed
 *  - the payload is deduped (+2 / +3 / +7 all dedupe via
 *    `sanitizeCopySlotTargets`)
 *  - confirm is disabled when no valid target remains
 *  - the slot selector renders all `slots`, defaults to `sourceSlot`,
 *    and `onConfirm` receives the chosen `targetSlot`
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyMealDialog } from "../../src/app/components/suppr/copy-meal-dialog";

// Ensure JSX runtime finds React under vitest/jsdom.
void React;

const SLOTS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;

function Harness({
  sourceDayKey,
  sourceSlot = "Breakfast",
  slots = SLOTS,
  onConfirm,
}: {
  sourceDayKey: string;
  sourceSlot?: string;
  slots?: readonly string[];
  onConfirm: (keys: string[], targetSlot: string, summary: string) => void;
}) {
  const [open, setOpen] = React.useState(true);
  return (
    <CopyMealDialog
      open={open}
      onOpenChange={setOpen}
      sourceDayKey={sourceDayKey}
      sourceSlot={sourceSlot}
      slots={slots}
      mealLabel="Greek yoghurt bowl"
      onConfirm={(keys, targetSlot, summary) => {
        onConfirm(keys, targetSlot, summary);
        setOpen(false);
      }}
    />
  );
}

describe("CopyMealDialog (F2)", () => {
  it("defaults the target to source +1 and fires onConfirm with just that day", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness sourceDayKey="2026-04-17" onConfirm={onConfirm} />);

    // Sanity: the dialog shows the meal label in its description.
    expect(screen.getByText(/Greek yoghurt bowl/i)).toBeInTheDocument();

    // The date input should be prefilled with 2026-04-18 (source +1).
    const dateInput = screen.getByLabelText(/target day/i) as HTMLInputElement;
    expect(dateInput.value).toBe("2026-04-18");

    await user.click(screen.getByRole("button", { name: /^copy$/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0]).toEqual(["2026-04-18"]);
  });

  it("lets the user pick a different target date and returns just that one", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness sourceDayKey="2026-04-17" onConfirm={onConfirm} />);

    const dateInput = screen.getByLabelText(/target day/i) as HTMLInputElement;
    // Use fireEvent for date input (jsdom / user-event doesn't expose
    // a reliable keyboard flow for `<input type=date>`).
    fireEvent.change(dateInput, { target: { value: "2026-04-25" } });

    await user.click(screen.getByRole("button", { name: /^copy$/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0]).toEqual(["2026-04-25"]);
  });

  it("extends the target list via the +3 days chip and dedupes / excludes source", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness sourceDayKey="2026-04-17" onConfirm={onConfirm} />);

    await user.click(screen.getByRole("button", { name: /next 3 days/i }));
    await user.click(screen.getByRole("button", { name: /^copy$/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    // Primary date is source+1 = 2026-04-18. Chip extends by 2 more days.
    // Source (2026-04-17) must not appear; no duplicates.
    expect(onConfirm.mock.calls[0][0]).toEqual([
      "2026-04-18",
      "2026-04-19",
      "2026-04-20",
    ]);
  });

  it("excludes the source day when the user picks it as the target, and disables confirm", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness sourceDayKey="2026-04-17" onConfirm={onConfirm} />);

    const dateInput = screen.getByLabelText(/target day/i) as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2026-04-17" } });

    const copyBtn = screen.getByRole("button", { name: /^copy$/i });
    expect(copyBtn).toBeDisabled();
    await user.click(copyBtn);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("when source is the primary target but a range chip is active, returns only the non-source days", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness sourceDayKey="2026-04-17" onConfirm={onConfirm} />);

    // Pick source day as the primary AND activate a +3 range.
    const dateInput = screen.getByLabelText(/target day/i) as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2026-04-17" } });
    await user.click(screen.getByRole("button", { name: /next 3 days/i }));

    // The range is [17, 18, 19]. `sanitizeCopyTargets` drops 17 (the source).
    // Confirm is enabled because at least one non-source day remains.
    const copyBtn = screen.getByRole("button", { name: /^copy$/i });
    expect(copyBtn).not.toBeDisabled();
    await user.click(copyBtn);
    expect(onConfirm).toHaveBeenCalledWith(
      ["2026-04-18", "2026-04-19"],
      "Breakfast",
      expect.stringMatching(/2 days/i),
    );
  });

  describe("meal-slot selector (ENG-786 rebuild)", () => {
    it("renders a button for every slot the host passes", async () => {
      const onConfirm = vi.fn();
      render(
        <Harness sourceDayKey="2026-04-17" sourceSlot="Lunch" onConfirm={onConfirm} />,
      );
      for (const slot of SLOTS) {
        expect(screen.getByRole("button", { name: slot })).toBeInTheDocument();
      }
    });

    it("defaults the target slot to sourceSlot (pressed state + unchanged onConfirm payload)", async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      render(
        <Harness sourceDayKey="2026-04-17" sourceSlot="Lunch" onConfirm={onConfirm} />,
      );

      const lunchBtn = screen.getByRole("button", { name: "Lunch" });
      expect(lunchBtn).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: "Dinner" })).toHaveAttribute(
        "aria-pressed",
        "false",
      );

      await user.click(screen.getByRole("button", { name: /^copy$/i }));
      expect(onConfirm).toHaveBeenCalledTimes(1);
      // targetSlot === sourceSlot -> no " · Slot" suffix in the summary.
      expect(onConfirm.mock.calls[0]).toEqual([
        ["2026-04-18"],
        "Lunch",
        "Copied to Sat 18 Apr",
      ]);
    });

    it("onConfirm receives the chosen targetSlot when the user picks a different one", async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      render(
        <Harness sourceDayKey="2026-04-17" sourceSlot="Lunch" onConfirm={onConfirm} />,
      );

      await user.click(screen.getByRole("button", { name: "Dinner" }));
      await user.click(screen.getByRole("button", { name: /^copy$/i }));

      expect(onConfirm).toHaveBeenCalledTimes(1);
      const [targetDayKeys, targetSlot, summary] = onConfirm.mock.calls[0]!;
      expect(targetDayKeys).toEqual(["2026-04-18"]);
      expect(targetSlot).toBe("Dinner");
      // Slot changed -> summary carries the " · Dinner" suffix.
      expect(summary).toBe("Copied to Sat 18 Apr · Dinner");
    });

    it("same-day + same-slot target is excluded (true no-op)", async () => {
      const onConfirm = vi.fn();
      render(
        <Harness sourceDayKey="2026-04-17" sourceSlot="Lunch" onConfirm={onConfirm} />,
      );

      const dateInput = screen.getByLabelText(/target day/i) as HTMLInputElement;
      fireEvent.change(dateInput, { target: { value: "2026-04-17" } });

      const copyBtn = screen.getByRole("button", { name: /^copy$/i });
      expect(copyBtn).toBeDisabled();
    });

    it("same-day + DIFFERENT-slot target is allowed (renaming the slot on the same day is a legal copy)", async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      render(
        <Harness sourceDayKey="2026-04-17" sourceSlot="Lunch" onConfirm={onConfirm} />,
      );

      const dateInput = screen.getByLabelText(/target day/i) as HTMLInputElement;
      fireEvent.change(dateInput, { target: { value: "2026-04-17" } });
      await user.click(screen.getByRole("button", { name: "Dinner" }));

      const copyBtn = screen.getByRole("button", { name: /^copy$/i });
      expect(copyBtn).not.toBeDisabled();
      await user.click(copyBtn);

      expect(onConfirm).toHaveBeenCalledWith(
        ["2026-04-17"],
        "Dinner",
        "Copied to Fri 17 Apr · Dinner",
      );
    });

    it("re-opening with a new sourceSlot resets targetSlot back to the new default", () => {
      const onConfirm = vi.fn();
      const { rerender } = render(
        <Harness sourceDayKey="2026-04-17" sourceSlot="Lunch" onConfirm={onConfirm} />,
      );
      expect(screen.getByRole("button", { name: "Lunch" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );

      rerender(
        <Harness sourceDayKey="2026-04-17" sourceSlot="Snacks" onConfirm={onConfirm} />,
      );
      expect(screen.getByRole("button", { name: "Snacks" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByRole("button", { name: "Lunch" })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    });
  });
});
