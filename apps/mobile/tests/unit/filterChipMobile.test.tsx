// @vitest-environment jsdom
/**
 * FilterChip (mobile) — §7 filter/option chip primitive (ENG-1375 S1, chip
 * ruling `docs/decisions/2026-07-10-chip-grammar-soft-tint.md`). Mirrors the
 * web primitive test `tests/unit/filterChip.test.tsx`: soft tint carries
 * selection (primarySoft fill + primarySolid semibold label), rest is a quiet
 * borderless card/secondary fill.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

const COLORS = {
  card: "#FFFFFF",
  backgroundSecondary: "#F1F0F4",
  textSecondary: "#5E5566",
};
const ACCENT = {
  primarySolid: "#3B2A4D",
  primarySoft: "rgba(91, 59, 110, 0.12)",
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
  NotificationFeedbackType: { Success: "success" },
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));

import { FilterChip } from "../../components/ui/FilterChip";

const flat = (s: unknown): Record<string, unknown> => {
  if (Array.isArray(s)) {
    return s.reduce<Record<string, unknown>>(
      (acc, x) => ({ ...acc, ...(flat(x) as Record<string, unknown>) }),
      {},
    );
  }
  return (s ?? {}) as Record<string, unknown>;
};

describe("FilterChip (mobile §7 grammar)", () => {
  it("renders unselected with the quiet card fill and no border", () => {
    const { getByTestId, getByText } = render(
      <FilterChip label="Vegan" selected={false} onPress={() => {}} testID="chip" />,
    );
    const style = flat(getByTestId("chip").props.style);
    expect(style.backgroundColor).toBe(COLORS.card);
    expect(style.borderWidth).toBeUndefined();
    const labelStyle = flat(getByText("Vegan").props.style);
    expect(labelStyle.fontWeight).toBe("500");
    expect(labelStyle.color).toBe(COLORS.textSecondary);
  });

  it("renders the secondary rest fill for on-card (sheet) surfaces", () => {
    const { getByTestId } = render(
      <FilterChip label="g" onPress={() => {}} restFill="secondary" testID="chip" />,
    );
    expect(flat(getByTestId("chip").props.style).backgroundColor).toBe(
      COLORS.backgroundSecondary,
    );
  });

  it("renders selected with primarySoft fill + primarySolid semibold label", () => {
    const { getByTestId, getByText } = render(
      <FilterChip label="Vegan" selected onPress={() => {}} testID="chip" />,
    );
    const style = flat(getByTestId("chip").props.style);
    expect(style.backgroundColor).toBe(ACCENT.primarySoft);
    expect(style.borderWidth).toBeUndefined();
    const labelStyle = flat(getByText("Vegan").props.style);
    expect(labelStyle.fontWeight).toBe("600");
    expect(labelStyle.color).toBe(ACCENT.primarySolid);
    expect(getByTestId("chip").props.accessibilityState?.selected).toBe(true);
  });

  it("fires onPress", () => {
    const onPress = vi.fn();
    const { getByTestId } = render(
      <FilterChip label="Gluten free" onPress={onPress} testID="chip" />,
    );
    fireEvent.press(getByTestId("chip"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("routes through PressableScale with the selection haptic (source pin)", () => {
    const src = readFileSync(
      resolve(__dirname, "../../components/ui/FilterChip.tsx"),
      "utf8",
    );
    expect(src).toMatch(/from "@\/components\/ui\/PressableScale"/);
    expect(src).toMatch(/haptic="selection"/);
    expect(src).toMatch(/borderRadius:\s*Radius\.full/);
  });
});
