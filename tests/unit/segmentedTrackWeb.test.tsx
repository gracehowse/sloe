/**
 * SegmentedTrack (web) — behavioural pins for THE §8 segmented primitive
 * (ENG-1375 S2, `docs/decisions/2026-07-10-chip-grammar-soft-tint.md`,
 * "Segmented controls" section).
 *
 *   - renders a tablist (default) or radiogroup with the right per-segment
 *     roles + selection attributes,
 *   - click fires onChange with the segment value; clicking the active
 *     segment is a no-op,
 *   - roving tabindex: only the active segment is focusable,
 *   - arrow keys move the selection (wrapping both ways),
 *   - §8 treatment: card-white thumb + shadow + primary-solid semibold on
 *     the active segment only.
 *
 * Mobile mirror: `apps/mobile/tests/unit/segmentedTrack.test.tsx`.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { SegmentedTrack } from "../../src/app/components/ui/segmented-track";

const OPTIONS = [
  { value: "a", label: "Alpha", testId: "seg-a" },
  { value: "b", label: "Beta", testId: "seg-b" },
  { value: "c", label: "Gamma", testId: "seg-c", ariaLabel: "Gamma view" },
] as const;

function renderTrack(
  value: "a" | "b" | "c",
  extra?: Partial<React.ComponentProps<typeof SegmentedTrack>>,
) {
  const onChange = vi.fn();
  render(
    <SegmentedTrack
      ariaLabel="Example"
      testId="seg-track"
      options={OPTIONS as unknown as { value: string; label: React.ReactNode }[]}
      value={value}
      onChange={onChange}
      {...extra}
    />,
  );
  return onChange;
}

describe("SegmentedTrack (web)", () => {
  it("renders a tablist of tabs with aria-selected on the active segment", () => {
    renderTrack("b");
    expect(screen.getByRole("tablist", { name: "Example" })).toBeTruthy();
    expect(screen.getByTestId("seg-b").getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("seg-a").getAttribute("aria-selected")).toBe("false");
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("renders a radiogroup of radios with aria-checked when role=radiogroup", () => {
    renderTrack("a", { role: "radiogroup" });
    expect(screen.getByRole("radiogroup", { name: "Example" })).toBeTruthy();
    expect(screen.getByTestId("seg-a").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("seg-b").getAttribute("aria-checked")).toBe("false");
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("forwards per-segment aria-labels for terse visual labels", () => {
    renderTrack("a");
    expect(screen.getByRole("tab", { name: "Gamma view" })).toBeTruthy();
  });

  it("click fires onChange with the segment value", () => {
    const onChange = renderTrack("a");
    fireEvent.click(screen.getByTestId("seg-c"));
    expect(onChange).toHaveBeenCalledWith("c");
  });

  it("clicking the already-active segment is a no-op", () => {
    const onChange = renderTrack("a");
    fireEvent.click(screen.getByTestId("seg-a"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("roving tabindex — only the active segment is focusable", () => {
    renderTrack("b");
    expect(screen.getByTestId("seg-b").getAttribute("tabindex")).toBe("0");
    expect(screen.getByTestId("seg-a").getAttribute("tabindex")).toBe("-1");
    expect(screen.getByTestId("seg-c").getAttribute("tabindex")).toBe("-1");
  });

  it("ArrowRight moves the selection forward; ArrowLeft wraps backward", () => {
    const onChange = renderTrack("a");
    fireEvent.keyDown(screen.getByTestId("seg-track"), { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("b");
    fireEvent.keyDown(screen.getByTestId("seg-track"), { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith("c"); // wraps a → c
  });

  it("§8 treatment — card-white thumb + shadow + primary-solid semibold on the active segment only", () => {
    renderTrack("b");
    const active = screen.getByTestId("seg-b");
    expect(active.className).toContain("bg-card");
    expect(active.className).toContain("shadow-sm");
    expect(active.className).toContain("font-semibold");
    expect(active.className).toContain("text-primary-solid");
    const inactive = screen.getByTestId("seg-a");
    expect(inactive.className).toContain("text-muted-foreground");
    expect(inactive.className).not.toContain("bg-card");
    // The track is the full-radius muted rail with the 2px pad.
    const track = screen.getByTestId("seg-track");
    expect(track.className).toContain("rounded-full");
    expect(track.className).toContain("bg-muted");
    expect(track.className).toContain("p-0.5");
  });

  // ENG-1532 amendment — optional per-option count badge (SubTabPill's badge
  // pill treatment: hidden at 0, "999+" cap).
  describe("count badge", () => {
    const renderBadge = (badge: number) => {
      const onChange = vi.fn();
      render(
        <SegmentedTrack
          ariaLabel="Example"
          options={
            [
              { value: "a", label: "Alpha", testId: "seg-a" },
              { value: "b", label: "Beta", testId: "seg-b", badge },
            ] as unknown as { value: string; label: React.ReactNode }[]
          }
          value="a"
          onChange={onChange}
        />,
      );
    };

    it("renders the count when badge > 0", () => {
      renderBadge(5);
      expect(screen.getByText("5")).toBeTruthy();
    });

    it("hides the badge at 0", () => {
      renderBadge(0);
      expect(screen.queryByText("0")).toBeNull();
    });

    it("caps the count at 999+", () => {
      renderBadge(1234);
      expect(screen.getByText("999+")).toBeTruthy();
    });
  });
});
