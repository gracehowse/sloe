// @vitest-environment jsdom
/**
 * AddRowButton (mobile) — the ONE add-row / AddControl grammar (ENG-1375 S4,
 * AddControl ruling in `docs/decisions/2026-07-10-chip-grammar-soft-tint.md`):
 * quiet-fill pill — `colors.fillQuiet`, radius 12 (Radius.xl), Plus glyph +
 * `accent.primarySolid` semibold label. Dashed borders are upload dropzones
 * ONLY. Web mirror test: `tests/unit/addRowButton.test.tsx`.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";
import { ActivityIndicator } from "react-native";

const COLORS = {
  fillQuiet: "#F1F0F4",
};
const ACCENT = {
  primarySolid: "#3B2A4D",
};

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => COLORS,
}));
vi.mock("@/context/theme", () => ({
  useAccent: () => ACCENT,
}));
vi.mock("expo-haptics", () => ({
  selectionAsync: vi.fn(),
  notificationAsync: vi.fn(),
  impactAsync: vi.fn(),
  NotificationFeedbackType: { Success: "success", Warning: "warning" },
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));

import { AddRowButton } from "../../components/ui/AddRowButton";

const flat = (s: unknown): Record<string, unknown> => {
  if (Array.isArray(s)) {
    return s.reduce<Record<string, unknown>>(
      (acc, x) => ({ ...acc, ...(flat(x) as Record<string, unknown>) }),
      {},
    );
  }
  return (s ?? {}) as Record<string, unknown>;
};

describe("AddRowButton (mobile AddControl grammar)", () => {
  it("renders the quiet-fill pill — fillQuiet bg, radius 12, no border, primary-solid semibold label", () => {
    const { getByTestId, getByText } = render(
      <AddRowButton label="Add food" onPress={() => {}} testID="add" />,
    );
    const style = flat(getByTestId("add").props.style);
    expect(style.backgroundColor).toBe(COLORS.fillQuiet);
    expect(style.borderRadius).toBe(12);
    // NO border — dashed edges are upload dropzones only.
    expect(style.borderWidth).toBeUndefined();
    const labelStyle = flat(getByText("Add food").props.style);
    expect(labelStyle.fontWeight).toBe("600");
    expect(labelStyle.color).toBe(ACCENT.primarySolid);
  });

  it("fires onPress and defaults the accessibility label to the label", () => {
    const onPress = vi.fn();
    const { getByLabelText } = render(
      <AddRowButton label="Add ingredient" onPress={onPress} testID="add" />,
    );
    fireEvent.press(getByLabelText("Add ingredient"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  // NOTE: `fireEvent.press(host)` in this harness climbs composites and finds
  // the `onPress` prop on the <AddRowButton> element itself, so a not-called
  // spy is unfalsifiable here. The real contract is that NO handler is wired
  // to the pressable host while disabled/loading (the primitive nulls it —
  // no double-submit) — assert that plus the a11y state.
  it("disabled unwires the press handler and dims", () => {
    const onPress = vi.fn();
    const { getByTestId } = render(
      <AddRowButton label="Add food" onPress={onPress} disabled testID="add" />,
    );
    const btn = getByTestId("add");
    expect(btn.props.onPress).toBeUndefined();
    expect(flat(btn.props.style).opacity).toBe(0.5);
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });

  it("loading unwires the press handler, marks busy, and swaps the glyph for a spinner", () => {
    const onPress = vi.fn();
    const { getByTestId, UNSAFE_queryAllByType } = render(
      <AddRowButton label="Add food" onPress={onPress} loading testID="add" />,
    );
    const btn = getByTestId("add");
    expect(btn.props.onPress).toBeUndefined();
    expect(btn.props.accessibilityState?.disabled).toBe(true);
    expect(btn.props.accessibilityState?.busy).toBe(true);
    expect(UNSAFE_queryAllByType(ActivityIndicator).length).toBe(1);
  });

  it("size='sm' keeps the grammar but drops to the captionSmall ramp (dense planner rows)", () => {
    const { getByText } = render(
      <AddRowButton label="Lunch" onPress={() => {}} size="sm" testID="add" />,
    );
    const labelStyle = flat(getByText("Lunch").props.style);
    expect(labelStyle.fontSize).toBe(12);
    expect(labelStyle.fontWeight).toBe("600");
  });
});
