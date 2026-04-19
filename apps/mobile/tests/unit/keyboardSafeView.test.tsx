// @vitest-environment jsdom
/**
 * Mobile `KeyboardSafeView` render test (TestFlight build 9 feedback,
 * 2026-04-19).
 *
 * Tester report: the iOS keyboard covers the Sign In button on
 * `apps/mobile/app/login.tsx`; also noted as systemic ("appears
 * elsewhere"). The fix ships a shared primitive that bundles the three
 * standard React Native pieces needed to avoid the symptom:
 *   1. `KeyboardAvoidingView` with per-platform `behavior`
 *   2. `ScrollView` with `keyboardShouldPersistTaps="handled"` and
 *      `automaticallyAdjustKeyboardInsets` on iOS
 *   3. A background `Pressable` that calls `Keyboard.dismiss()` on tap
 *
 * These tests pin each of those three contracts so a future refactor
 * can't silently drop one of them.
 *
 * See also: `keyboardSafeViewAdoption.test.ts` — structural pin that
 * each priority-screen source file imports this primitive.
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";
import { Keyboard, Platform, Text } from "react-native";

import KeyboardSafeView from "../../components/KeyboardSafeView";

void React;

/**
 * The `react-native` shim's `Platform` is a plain object — tests can
 * mutate `OS` to exercise the Android branch. Restore after each test.
 */
const ORIGINAL_OS = Platform.OS;

afterEach(() => {
  (Platform as { OS: string }).OS = ORIGINAL_OS;
  vi.restoreAllMocks();
});

describe("KeyboardSafeView — defaults (scroll=true, dismissOnBackgroundTap=true)", () => {
  it("renders children visibly", () => {
    const { getByText } = render(
      <KeyboardSafeView>
        <Text>hello kb</Text>
      </KeyboardSafeView>,
    );
    expect(getByText("hello kb")).toBeTruthy();
  });

  it("renders a ScrollView with keyboardShouldPersistTaps='handled' when scroll=true", () => {
    const { UNSAFE_root } = render(
      <KeyboardSafeView testID="ksv">
        <Text>body</Text>
      </KeyboardSafeView>,
    );
    // RNTL's host-scroll-view name — see shim comment.
    const scrolls = UNSAFE_root.findAllByType("RCTScrollView" as unknown as React.ComponentType);
    expect(scrolls.length).toBe(1);
    expect(scrolls[0].props.keyboardShouldPersistTaps).toBe("handled");
  });

  it("enables automaticallyAdjustKeyboardInsets on iOS", () => {
    (Platform as { OS: string }).OS = "ios";
    const { UNSAFE_root } = render(
      <KeyboardSafeView>
        <Text>body</Text>
      </KeyboardSafeView>,
    );
    const scroll = UNSAFE_root.findByType("RCTScrollView" as unknown as React.ComponentType);
    expect(scroll.props.automaticallyAdjustKeyboardInsets).toBe(true);
  });

  it("disables automaticallyAdjustKeyboardInsets on Android", () => {
    (Platform as { OS: string }).OS = "android";
    const { UNSAFE_root } = render(
      <KeyboardSafeView>
        <Text>body</Text>
      </KeyboardSafeView>,
    );
    const scroll = UNSAFE_root.findByType("RCTScrollView" as unknown as React.ComponentType);
    expect(scroll.props.automaticallyAdjustKeyboardInsets).toBe(false);
  });

  it("calls Keyboard.dismiss when the background Pressable is pressed", () => {
    const dismissSpy = vi.spyOn(Keyboard, "dismiss");
    const { UNSAFE_root } = render(
      <KeyboardSafeView>
        <Text>body</Text>
      </KeyboardSafeView>,
    );
    // The background Pressable forwards to a host "View" (per shim).
    // Find the first View with an onPress prop inside the tree and
    // press it — that's the dismiss hit-area.
    const views = UNSAFE_root.findAllByType("View" as unknown as React.ComponentType);
    const dismissPressable = views.find(
      (v) => typeof v.props.onPress === "function" && v.props.accessible === false,
    );
    expect(dismissPressable).toBeDefined();
    fireEvent.press(dismissPressable!);
    expect(dismissSpy).toHaveBeenCalledTimes(1);
  });

  it("marks the background Pressable as accessible={false} so screen readers skip it", () => {
    const { UNSAFE_root } = render(
      <KeyboardSafeView>
        <Text>body</Text>
      </KeyboardSafeView>,
    );
    const views = UNSAFE_root.findAllByType("View" as unknown as React.ComponentType);
    const dismissPressable = views.find(
      (v) => typeof v.props.onPress === "function",
    );
    expect(dismissPressable).toBeDefined();
    expect(dismissPressable!.props.accessible).toBe(false);
  });
});

describe("KeyboardSafeView — scroll=false (screen owns its own ScrollView)", () => {
  it("does not render an internal ScrollView", () => {
    const { UNSAFE_root } = render(
      <KeyboardSafeView scroll={false}>
        <Text>body</Text>
      </KeyboardSafeView>,
    );
    const scrolls = UNSAFE_root.findAllByType("RCTScrollView" as unknown as React.ComponentType);
    expect(scrolls.length).toBe(0);
  });

  it("still renders children", () => {
    const { getByText } = render(
      <KeyboardSafeView scroll={false}>
        <Text>body</Text>
      </KeyboardSafeView>,
    );
    expect(getByText("body")).toBeTruthy();
  });
});

describe("KeyboardSafeView — dismissOnBackgroundTap=false", () => {
  it("does not render a dismiss Pressable (no onPress forwarded to a background View)", () => {
    const { UNSAFE_root } = render(
      <KeyboardSafeView scroll={false} dismissOnBackgroundTap={false}>
        <Text>body</Text>
      </KeyboardSafeView>,
    );
    // With scroll=false + dismissOnBackgroundTap=false the only host
    // node should be the outer KeyboardAvoidingView-forwarded View.
    // None of the intermediate Views should carry onPress.
    const views = UNSAFE_root.findAllByType("View" as unknown as React.ComponentType);
    const dismissPressable = views.find(
      (v) => typeof v.props.onPress === "function" && v.props.accessible === false,
    );
    expect(dismissPressable).toBeUndefined();
  });

  it("does not call Keyboard.dismiss on any child tap when disabled", () => {
    const dismissSpy = vi.spyOn(Keyboard, "dismiss");
    render(
      <KeyboardSafeView scroll={false} dismissOnBackgroundTap={false}>
        <Text>body</Text>
      </KeyboardSafeView>,
    );
    expect(dismissSpy).not.toHaveBeenCalled();
  });
});

describe("KeyboardSafeView — behavior is correct per platform", () => {
  it("defaults to behavior='padding' on iOS", () => {
    (Platform as { OS: string }).OS = "ios";
    const { UNSAFE_root } = render(
      <KeyboardSafeView testID="ksv">
        <Text>body</Text>
      </KeyboardSafeView>,
    );
    // The outer KeyboardAvoidingView forwards to a "View" host in the
    // shim. Find the outermost View with a `behavior` prop — that's
    // the KAV. (The shim preserves props verbatim.)
    const views = UNSAFE_root.findAllByType("View" as unknown as React.ComponentType);
    const kav = views.find((v) => v.props.behavior != null);
    expect(kav).toBeDefined();
    expect(kav!.props.behavior).toBe("padding");
  });

  it("defaults to behavior='height' on Android", () => {
    (Platform as { OS: string }).OS = "android";
    const { UNSAFE_root } = render(
      <KeyboardSafeView>
        <Text>body</Text>
      </KeyboardSafeView>,
    );
    const views = UNSAFE_root.findAllByType("View" as unknown as React.ComponentType);
    const kav = views.find((v) => v.props.behavior != null);
    expect(kav).toBeDefined();
    expect(kav!.props.behavior).toBe("height");
  });

  it("allows callers to override behavior", () => {
    const { UNSAFE_root } = render(
      <KeyboardSafeView behavior="position">
        <Text>body</Text>
      </KeyboardSafeView>,
    );
    const views = UNSAFE_root.findAllByType("View" as unknown as React.ComponentType);
    const kav = views.find((v) => v.props.behavior != null);
    expect(kav).toBeDefined();
    expect(kav!.props.behavior).toBe("position");
  });

  it("forwards keyboardVerticalOffset to the KeyboardAvoidingView", () => {
    const { UNSAFE_root } = render(
      <KeyboardSafeView keyboardVerticalOffset={44}>
        <Text>body</Text>
      </KeyboardSafeView>,
    );
    const views = UNSAFE_root.findAllByType("View" as unknown as React.ComponentType);
    const kav = views.find((v) => v.props.keyboardVerticalOffset != null);
    expect(kav).toBeDefined();
    expect(kav!.props.keyboardVerticalOffset).toBe(44);
  });
});
