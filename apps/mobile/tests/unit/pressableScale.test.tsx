/**
 * PressableScale — production-design-spec §1.1 press-feedback primitive.
 *
 * Pins:
 *   - children render
 *   - onPress fires on press
 *   - selection haptic fires on press-in by default
 *   - haptic="none" disables the haptic
 */

import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";
import { Text } from "react-native";

import { PressableScale } from "../../components/ui/PressableScale";

vi.mock("expo-haptics", () => ({
  selectionAsync: vi.fn(async () => undefined),
  impactAsync: vi.fn(async () => undefined),
  notificationAsync: vi.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: { Success: "success" },
}));

describe("PressableScale (mobile)", () => {
  it("renders children", () => {
    const { getByText } = render(
      <PressableScale onPress={() => {}}>
        <Text>tap me</Text>
      </PressableScale>,
    );
    expect(getByText("tap me")).toBeTruthy();
  });

  it("invokes onPress when pressed", () => {
    const onPress = vi.fn();
    const { getByText } = render(
      <PressableScale onPress={onPress}>
        <Text>tap me</Text>
      </PressableScale>,
    );
    fireEvent.press(getByText("tap me"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("fires selection haptic on press-in by default", async () => {
    const Haptics = await import("expo-haptics");
    (Haptics.selectionAsync as ReturnType<typeof vi.fn>).mockClear();
    const { getByText } = render(
      <PressableScale onPress={() => {}}>
        <Text>tap me</Text>
      </PressableScale>,
    );
    fireEvent(getByText("tap me"), "pressIn");
    expect(Haptics.selectionAsync).toHaveBeenCalled();
  });

  it("does not fire haptic when haptic='none'", async () => {
    const Haptics = await import("expo-haptics");
    (Haptics.selectionAsync as ReturnType<typeof vi.fn>).mockClear();
    (Haptics.impactAsync as ReturnType<typeof vi.fn>).mockClear();
    const { getByText } = render(
      <PressableScale onPress={() => {}} haptic="none">
        <Text>tap me</Text>
      </PressableScale>,
    );
    fireEvent(getByText("tap me"), "pressIn");
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it("forwards custom onPressIn alongside the haptic", async () => {
    const Haptics = await import("expo-haptics");
    (Haptics.selectionAsync as ReturnType<typeof vi.fn>).mockClear();
    const onPressIn = vi.fn();
    const { getByText } = render(
      <PressableScale onPress={() => {}} onPressIn={onPressIn}>
        <Text>tap me</Text>
      </PressableScale>,
    );
    fireEvent(getByText("tap me"), "pressIn");
    expect(onPressIn).toHaveBeenCalledTimes(1);
    expect(Haptics.selectionAsync).toHaveBeenCalled();
  });
});
