/**
 * SegmentedTrack (mobile) — behavioural pins for THE §8 segmented primitive
 * (ENG-1375 S3, `docs/decisions/2026-07-10-chip-grammar-soft-tint.md`,
 * "Segmented controls" section).
 *
 *   - renders every segment with its testID + a11y role/state,
 *   - press fires onChange with the segment value; pressing the active
 *     segment is a no-op,
 *   - tablist (default) vs radiogroup roles,
 *   - §8 treatment: card-white thumb on the inputBg rail, primary-solid
 *     active label.
 *
 * Web mirror: `tests/unit/segmentedTrackWeb.test.tsx`.
 */
import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    card: "#fff",
    text: "#111",
    textSecondary: "#666",
    inputBg: "#f4f4f6",
  }),
}));

vi.mock("@/context/theme", () => ({
  useAccent: () => ({ primarySolid: "#7A5C8A", primarySoft: "rgba(122,92,138,0.18)" }),
}));

import { SegmentedTrack } from "../../components/ui/SegmentedTrack";

const OPTIONS = [
  { value: "a", label: "Alpha", testID: "seg-a" },
  { value: "b", label: "Beta", testID: "seg-b" },
  { value: "c", label: "Gamma", testID: "seg-c", accessibilityLabel: "Gamma view" },
] as const;

function renderTrack(
  value: "a" | "b" | "c",
  extra?: Partial<React.ComponentProps<typeof SegmentedTrack>>,
) {
  const onChange = vi.fn();
  const utils = render(
    <SegmentedTrack
      accessibilityLabel="Example"
      testID="seg-track"
      options={OPTIONS as unknown as { value: string; label: React.ReactNode }[]}
      value={value}
      onChange={onChange}
      {...extra}
    />,
  );
  return { ...utils, onChange };
}

describe("SegmentedTrack (mobile)", () => {
  it("renders every segment with its testID", () => {
    const { getByTestId } = renderTrack("a");
    for (const id of ["seg-track", "seg-a", "seg-b", "seg-c"]) {
      expect(getByTestId(id)).toBeTruthy();
    }
  });

  it("is a tablist of tabs by default, with selected state on the active segment", () => {
    const { getByTestId } = renderTrack("b");
    expect(getByTestId("seg-track").props.accessibilityRole).toBe("tablist");
    expect(getByTestId("seg-b").props.accessibilityRole).toBe("tab");
    expect(getByTestId("seg-b").props.accessibilityState).toMatchObject({ selected: true });
    expect(getByTestId("seg-a").props.accessibilityState).toMatchObject({ selected: false });
  });

  it("renders radios when role=radiogroup", () => {
    const { getByTestId } = renderTrack("a", { role: "radiogroup" });
    expect(getByTestId("seg-track").props.accessibilityRole).toBe("radiogroup");
    expect(getByTestId("seg-a").props.accessibilityRole).toBe("radio");
  });

  it("forwards per-segment accessibility labels for terse visual labels", () => {
    const { getByTestId } = renderTrack("a");
    expect(getByTestId("seg-c").props.accessibilityLabel).toBe("Gamma view");
  });

  it("press fires onChange with the segment value", () => {
    const { getByTestId, onChange } = renderTrack("a");
    fireEvent.press(getByTestId("seg-c"));
    expect(onChange).toHaveBeenCalledWith("c");
  });

  it("pressing the already-active segment is a no-op", () => {
    const { getByTestId, onChange } = renderTrack("a");
    fireEvent.press(getByTestId("seg-a"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("§8 treatment — card-white thumb on the inputBg rail, primary-solid active label", () => {
    const { getByTestId, getByText } = renderTrack("b");
    const trackStyle = StyleFlat(getByTestId("seg-track").props.style);
    expect(trackStyle.backgroundColor).toBe("#f4f4f6");
    expect(trackStyle.borderRadius).toBe(9999);
    expect(trackStyle.padding).toBe(2);
    const activeStyle = StyleFlat(getByTestId("seg-b").props.style);
    expect(activeStyle.backgroundColor).toBe("#fff");
    const inactiveStyle = StyleFlat(getByTestId("seg-a").props.style);
    expect(inactiveStyle.backgroundColor).toBeUndefined();
    const activeLabel = StyleFlat(getByText("Beta").props.style);
    expect(activeLabel.color).toBe("#7A5C8A");
    expect(activeLabel.fontWeight).toBe("600");
    const inactiveLabel = StyleFlat(getByText("Alpha").props.style);
    expect(inactiveLabel.color).toBe("#666");
    expect(inactiveLabel.fontWeight).toBe("500");
  });
});

/** Flatten an RN style prop (arrays, nested arrays, falsy entries) into one object. */
function StyleFlat(style: unknown): Record<string, unknown> {
  if (!style) return {};
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (acc, s) => ({ ...acc, ...StyleFlat(s) }),
      {},
    );
  }
  return style as Record<string, unknown>;
}
