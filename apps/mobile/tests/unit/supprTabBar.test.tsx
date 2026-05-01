/**
 * supprTabBar — pins the centered raised Log button pattern that
 * replaces the side `<LogFab>` (right: 18, bottom: 100) on mobile.
 *
 * Authority: customer-lens audit 2026-04-30 — the side FAB overlapped
 * right-edge meal cards + macro tile column, and broke iOS genre
 * convention (Cal AI / Lifesum / MyFitnessPal / Twitter X all use a
 * centered raised tab-bar button).
 *
 * Constraints carried forward from D-2026-04-27-02:
 *   - The tab bar still has exactly four primary screen routes
 *     (Today / Recipes / Plan / You). The raised button is purely
 *     a visual element; no fifth Tabs.Screen.
 *   - The raised button is global to all tabs — tapping it from any
 *     tab routes to Today with `?openLog=1` so the canonical
 *     `<LogSheet>` opens (Today owns the journal write path).
 *
 * Scope of this file:
 *   - <LogTabBarButton>: accessibility, testID continuity, onPress.
 *   - <SupprTabBar>: 5-slot layout (4 tabs + raised button between
 *     Recipes and Plan), tabPress emit, defaultPrevented respect,
 *     navigation.navigate on press, raised-button onPress routes
 *     Today with `?openLog=1`.
 */

import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";
import * as React from "react";

import { LogTabBarButton } from "../../components/tabs/LogTabBarButton";
import { SupprTabBar } from "../../components/tabs/SupprTabBar";

vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(async () => undefined),
  ImpactFeedbackStyle: { Medium: "medium", Light: "light" },
  selectionAsync: vi.fn(async () => undefined),
}));

const pushSpy = vi.fn();
vi.mock("expo-router", () => ({
  useRouter: () => ({ push: pushSpy }),
}));

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#000",
    textSecondary: "#555",
    background: "#fff",
    card: "#fff",
    cardBorder: "#eee",
    border: "#eee",
    tabIconDefault: "#999",
  }),
}));

// Tiny icon stand-in so we don't need to render Lucide SVGs in jsdom.
const StubIcon = (props: { color?: string }) =>
  React.createElement("Text", null, `icon:${props.color ?? "default"}`);

/**
 * Build a minimal `BottomTabBarProps` shape for the tests. Four
 * visible tabs (matching production) plus one hidden tab (`href: null`
 * style) to prove the tab bar filters them out. `state.index = 0`
 * focuses the first tab by default; override per test.
 */
function makeProps(opts?: {
  focusedIndex?: number;
  onTabPressDefaultPrevented?: boolean;
}) {
  const focusedIndex = opts?.focusedIndex ?? 0;
  const routes = [
    { key: "index-1", name: "index", params: undefined },
    { key: "library-1", name: "library", params: undefined },
    { key: "planner-1", name: "planner", params: undefined },
    { key: "progress-1", name: "progress", params: undefined },
    { key: "discover-1", name: "discover", params: undefined },
  ];

  const navigateSpy = vi.fn();
  const emitSpy = vi.fn(() => ({
    defaultPrevented: opts?.onTabPressDefaultPrevented ?? false,
  }));

  const descriptors = {
    "index-1": {
      options: {
        title: "Today",
        tabBarIcon: StubIcon,
        tabBarButtonTestID: "tab-today",
      },
    },
    "library-1": {
      options: {
        title: "Recipes",
        tabBarIcon: StubIcon,
        tabBarButtonTestID: "tab-recipes",
        tabBarAccessibilityLabel: "Recipes",
      },
    },
    "planner-1": {
      options: {
        title: "Plan",
        tabBarIcon: StubIcon,
        tabBarButtonTestID: "tab-plan",
      },
    },
    "progress-1": {
      options: {
        title: "You",
        tabBarIcon: StubIcon,
        tabBarButtonTestID: "tab-you",
        tabBarAccessibilityLabel: "You",
      },
    },
    // Hidden via href: null — should NOT render a tab button.
    "discover-1": {
      options: {
        href: null,
      },
    },
  } as Record<string, { options: Record<string, unknown> }>;

  return {
    state: { index: focusedIndex, routes, key: "tab-state", routeNames: routes.map((r) => r.name) },
    descriptors,
    navigation: { navigate: navigateSpy, emit: emitSpy },
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
    spies: { navigateSpy, emitSpy },
  };
}

describe("LogTabBarButton", () => {
  it("renders with the canonical accessibility label", () => {
    const { getByLabelText } = render(<LogTabBarButton onPress={() => {}} />);
    expect(getByLabelText("Log a meal")).toBeTruthy();
  });

  it("retains the legacy `today-log-fab` testID so existing Maestro flows keep matching", () => {
    // 02_today_screen.yaml / 22_barcode_scanner.yaml /
    // 32_food_search_modal.yaml all `tapOn: { id: "today-log-fab" }`.
    // Renaming the testID would silently break those flows.
    const { getByTestId } = render(<LogTabBarButton onPress={() => {}} />);
    expect(getByTestId("today-log-fab")).toBeTruthy();
  });

  it("calls onPress when the raised button is tapped", () => {
    const onPress = vi.fn();
    const { getByLabelText } = render(<LogTabBarButton onPress={onPress} />);
    fireEvent.press(getByLabelText("Log a meal"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("exposes `accessibilityRole='button'` (not 'tab') — it is UI, not a route", () => {
    const { getByLabelText } = render(<LogTabBarButton onPress={() => {}} />);
    expect(getByLabelText("Log a meal").props.accessibilityRole).toBe("button");
  });
});

describe("SupprTabBar", () => {
  it("renders exactly four primary tabs (filters out hidden href:null routes)", () => {
    const props = makeProps();
    const { getByLabelText, queryByLabelText } = render(
      <SupprTabBar
        state={props.state as never}
        descriptors={props.descriptors as never}
        navigation={props.navigation as never}
        insets={props.insets}
      />,
    );
    expect(getByLabelText("Today")).toBeTruthy();
    expect(getByLabelText("Recipes")).toBeTruthy();
    expect(getByLabelText("Plan")).toBeTruthy();
    expect(getByLabelText("You")).toBeTruthy();
    // Hidden discover route must not produce a tab.
    expect(queryByLabelText("discover")).toBeNull();
  });

  it("renders the raised Log button alongside the four primary tabs", () => {
    const props = makeProps();
    const { getByLabelText } = render(
      <SupprTabBar
        state={props.state as never}
        descriptors={props.descriptors as never}
        navigation={props.navigation as never}
        insets={props.insets}
      />,
    );
    expect(getByLabelText("Log a meal")).toBeTruthy();
  });

  it("marks the focused tab as accessibilityState.selected=true and the others as selected=false/undef", () => {
    // Focus index 2 = `planner` (Plan).
    const props = makeProps({ focusedIndex: 2 });
    const { getByLabelText } = render(
      <SupprTabBar
        state={props.state as never}
        descriptors={props.descriptors as never}
        navigation={props.navigation as never}
        insets={props.insets}
      />,
    );
    expect(getByLabelText("Plan").props.accessibilityState?.selected).toBe(true);
    expect(getByLabelText("Today").props.accessibilityState?.selected).toBeFalsy();
    expect(getByLabelText("Recipes").props.accessibilityState?.selected).toBeFalsy();
    expect(getByLabelText("You").props.accessibilityState?.selected).toBeFalsy();
  });

  it("emits tabPress on tap and navigates to the route (un-focused tap)", () => {
    // Currently focused on Today (index 0). Tap Recipes.
    const props = makeProps({ focusedIndex: 0 });
    const { getByLabelText } = render(
      <SupprTabBar
        state={props.state as never}
        descriptors={props.descriptors as never}
        navigation={props.navigation as never}
        insets={props.insets}
      />,
    );
    fireEvent.press(getByLabelText("Recipes"));
    expect(props.spies.emitSpy).toHaveBeenCalledWith({
      type: "tabPress",
      target: "library-1",
      canPreventDefault: true,
    });
    expect(props.spies.navigateSpy).toHaveBeenCalledWith("library", undefined);
  });

  it("does NOT navigate if a per-screen listener calls preventDefault on tabPress (e.g. the Recipes/You sub-tab intercepts in _layout.tsx)", () => {
    const props = makeProps({
      focusedIndex: 0,
      onTabPressDefaultPrevented: true,
    });
    const { getByLabelText } = render(
      <SupprTabBar
        state={props.state as never}
        descriptors={props.descriptors as never}
        navigation={props.navigation as never}
        insets={props.insets}
      />,
    );
    fireEvent.press(getByLabelText("Recipes"));
    expect(props.spies.emitSpy).toHaveBeenCalled();
    // navigation.navigate must not run — the listener owns the route
    // change (e.g. router.replace('/(tabs)/library') from /discover).
    expect(props.spies.navigateSpy).not.toHaveBeenCalled();
  });

  it("does NOT navigate when tapping the already-focused tab (idempotent)", () => {
    // Focused on Today; tap Today.
    const props = makeProps({ focusedIndex: 0 });
    const { getByLabelText } = render(
      <SupprTabBar
        state={props.state as never}
        descriptors={props.descriptors as never}
        navigation={props.navigation as never}
        insets={props.insets}
      />,
    );
    fireEvent.press(getByLabelText("Today"));
    // tabPress still emits (consistent with stock behaviour) but no
    // route change.
    expect(props.spies.navigateSpy).not.toHaveBeenCalled();
  });

  it("raised Log button routes to /(tabs)?openLog=1 (Today consumes the param to open the canonical LogSheet)", () => {
    pushSpy.mockClear();
    const props = makeProps();
    const { getByLabelText } = render(
      <SupprTabBar
        state={props.state as never}
        descriptors={props.descriptors as never}
        navigation={props.navigation as never}
        insets={props.insets}
      />,
    );
    fireEvent.press(getByLabelText("Log a meal"));
    expect(pushSpy).toHaveBeenCalledWith({
      pathname: "/(tabs)",
      params: { openLog: "1" },
    });
  });
});
