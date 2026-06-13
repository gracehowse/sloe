/**
 * supprButton — pins the shared CTA primitive (mobile).
 *
 * Grammar under test (`docs/decisions/2026-06-12-button-system-solid-primary.md`):
 *   - primary  → SOLID aubergine fill (#3B2A4D), WHITE label, NO border, NO shadow
 *   - ghost    → transparent fill, NO border, plum (#3B2A4D) label
 *   - disabled → blocks onPress
 *   - loading  → shows ActivityIndicator + blocks onPress (no double-submit)
 *
 * Mirrors the web pin `tests/unit/supprButton.test.tsx`.
 */
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";
import { ActivityIndicator } from "react-native";

import { SupprButton } from "../../components/ui/SupprButton";

vi.mock("expo-haptics", () => ({
  selectionAsync: vi.fn(async () => undefined),
  impactAsync: vi.fn(async () => undefined),
  notificationAsync: vi.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: { Success: "success" },
}));

// Deterministic LIGHT accent so primarySolid resolves to the plum #3B2A4D
// (the context default without a provider is the dark inverse #C4ACD0).
vi.mock("@/context/theme", () => ({
  useAccent: () => ({ primarySolid: "#3B2A4D", primary: "#3B2A4D" }),
}));

const PLUM = "#3B2A4D";

function flatten(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (acc, s) => ({ ...acc, ...flatten(s) }),
      {},
    );
  }
  return (style ?? {}) as Record<string, unknown>;
}

describe("SupprButton (mobile)", () => {
  it("primary: solid aubergine fill, white label, no border, no shadow", () => {
    const { getByTestId, getByText } = render(
      <SupprButton variant="primary" label="Complete Day" testID="cta" />,
    );
    const root = getByTestId("cta");
    const s = flatten(root.props.style);
    expect(s.backgroundColor).toBe(PLUM);
    // No border, no elevation/shadow on either variant.
    expect(s.borderWidth).toBeUndefined();
    expect(s.borderColor).toBeUndefined();
    expect(s.elevation).toBeUndefined();
    expect(s.shadowOpacity).toBeUndefined();
    expect(s.shadowColor).toBeUndefined();
    // Pill radius.
    expect(s.borderRadius).toBe(9999);

    const label = getByText("Complete Day");
    expect(flatten(label.props.style).color).toBe("#fff");
  });

  it("ghost: transparent fill, no border, plum label", () => {
    const { getByTestId, getByText } = render(
      <SupprButton variant="ghost" label="Skip" testID="cta" />,
    );
    const s = flatten(getByTestId("cta").props.style);
    expect(s.backgroundColor).toBe("transparent");
    expect(s.borderWidth).toBeUndefined();
    expect(s.borderColor).toBeUndefined();
    expect(s.elevation).toBeUndefined();
    expect(s.shadowOpacity).toBeUndefined();

    const label = getByText("Skip");
    expect(flatten(label.props.style).color).toBe(PLUM);
  });

  it("disabled blocks onPress and dims the surface", () => {
    const onPress = vi.fn();
    const { getByTestId } = render(
      <SupprButton variant="primary" label="Save" onPress={onPress} disabled testID="cta" />,
    );
    const root = getByTestId("cta");
    fireEvent.press(root);
    expect(onPress).not.toHaveBeenCalled();
    expect(root.props.accessibilityState?.disabled).toBe(true);
    expect(flatten(root.props.style).opacity).toBe(0.65); // ENG-1011 disabled floor
  });

  it("loading shows the indicator and blocks onPress (no double-submit)", () => {
    const onPress = vi.fn();
    const { getByTestId, queryByText, UNSAFE_getAllByType } = render(
      <SupprButton variant="primary" label="Save" onPress={onPress} loading testID="cta" />,
    );
    // Label is swapped for the spinner.
    expect(queryByText("Save")).toBeNull();
    expect(UNSAFE_getAllByType(ActivityIndicator).length).toBe(1);
    // Busy state announced + press blocked.
    const root = getByTestId("cta");
    expect(root.props.accessibilityState?.busy).toBe(true);
    fireEvent.press(root);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("enabled primary fires onPress", () => {
    const onPress = vi.fn();
    const { getByTestId } = render(
      <SupprButton variant="primary" label="Go" onPress={onPress} testID="cta" />,
    );
    fireEvent.press(getByTestId("cta"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
