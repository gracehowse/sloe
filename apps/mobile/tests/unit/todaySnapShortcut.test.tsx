/**
 * TodaySnapShortcut — mobile component pin.
 *
 * Authority: audit 2026-04-30 (Lose It "Closer" parity). The shortcut
 * surfaces PhotoLog as a one-tap entry point on Today. Tests pin:
 *   - Tap fires the host callback exactly once.
 *   - Default a11y label is "Snap a meal".
 *   - When `locked`, label flips to "Snap a meal (Pro)" so the gate
 *     is announced before the user taps.
 *   - Lock badge renders only when `locked === true`.
 *   - Canonical `today-snap-shortcut` testID for Maestro continuity.
 */

import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

import { TodaySnapShortcut } from "../../components/today/TodaySnapShortcut";

vi.mock("expo-haptics", () => ({
  selectionAsync: vi.fn(async () => undefined),
  impactAsync: vi.fn(async () => undefined),
  ImpactFeedbackStyle: { Medium: "medium", Light: "light" },
}));

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#000",
    textSecondary: "#666",
    textTertiary: "#999",
    background: "#fff",
    card: "#fff",
    cardBorder: "#eee",
    border: "#ddd",
  }),
}));

describe("TodaySnapShortcut (mobile)", () => {
  it("renders the canonical 'Snap a meal' label and supporting copy", () => {
    const { getByText } = render(<TodaySnapShortcut onPress={() => {}} />);
    expect(getByText("Snap a meal")).toBeTruthy();
    // 2026-05-12 (premium-bar audit Today F3 #2): subtitle reframed
    // to carry the speed signal + the AI-estimate trust signal.
    expect(getByText("~3 seconds · AI estimates macros, review before saving.")).toBeTruthy();
  });

  it("fires onPress exactly once when tapped", () => {
    const onPress = vi.fn();
    const { getByTestId } = render(<TodaySnapShortcut onPress={onPress} />);
    fireEvent.press(getByTestId("today-snap-shortcut"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("uses the default a11y label 'Snap a meal' when unlocked", () => {
    const { getByLabelText } = render(<TodaySnapShortcut onPress={() => {}} />);
    expect(getByLabelText("Snap a meal")).toBeTruthy();
  });

  it("flips the a11y label to 'Snap a meal (Pro)' when locked", () => {
    const { getByLabelText, queryByLabelText } = render(
      <TodaySnapShortcut onPress={() => {}} locked />,
    );
    expect(getByLabelText("Snap a meal (Pro)")).toBeTruthy();
    expect(queryByLabelText("Snap a meal")).toBeNull();
  });

  it("renders the lock badge only when locked", () => {
    const unlocked = render(<TodaySnapShortcut onPress={() => {}} />);
    expect(unlocked.queryByTestId("today-snap-shortcut-lock")).toBeNull();
    const locked = render(<TodaySnapShortcut onPress={() => {}} locked />);
    expect(locked.queryByTestId("today-snap-shortcut-lock")).toBeTruthy();
  });

  it("supports a custom testID for downstream test suites", () => {
    const { queryByTestId } = render(
      <TodaySnapShortcut onPress={() => {}} testID="custom-snap-id" />,
    );
    expect(queryByTestId("custom-snap-id")).toBeTruthy();
    expect(queryByTestId("today-snap-shortcut")).toBeNull();
  });

  it("renders the 44x44 shutter button (premium-bar audit Feature 3 #6, 2026-05-14)", () => {
    // The leading affordance was a 32x32 tinted square with a Camera
    // glyph. The audit replaces it with an iOS Camera-style filled
    // shutter button — 44x44, solid `Accent.primary` background,
    // white 22pt glyph. The testID + layout style are pinned so a
    // future refactor that tries to flatten the visual cue (e.g. to
    // just `<Camera>` without the circle) fires this test.
    const { getByTestId } = render(<TodaySnapShortcut onPress={() => {}} />);
    const shutter = getByTestId("today-snap-shortcut-shutter");
    expect(shutter).toBeTruthy();
    const style = shutter.props.style;
    const flat = Array.isArray(style)
      ? Object.assign({}, ...style.filter(Boolean))
      : style;
    expect(flat.width).toBe(44);
    expect(flat.height).toBe(44);
    expect(flat.borderRadius).toBe(22);
  });
});
