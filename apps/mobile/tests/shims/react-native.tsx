/**
 * Minimal `react-native` shim for vitest + `@testing-library/react-native`
 * (RNTL, 2026-04-18 / post-ship #3).
 *
 * Why this exists
 * ---------------
 * Expo / React Native's `react-native` package entry uses Flow syntax and
 * native-only globals (`__DEV__`, `nativeFabricUIManager`, etc.) so it
 * cannot be loaded by Node / vitest directly. `jest-expo` solves this
 * under jest; we stay on vitest (matching the existing mobile test runner
 * at `apps/mobile/vitest.config.ts`) and alias `react-native` to THIS
 * file instead.
 *
 * What it guarantees
 * ------------------
 * Every component the three render-level tests touch gets a host string
 * type that RNTL recognises (`"View"`, `"Text"`, `"Modal"`, …). RNTL's
 * `fireEvent.press` looks for `props.onPress` on a host element, so every
 * component here forwards props verbatim to a host element with the
 * right type name — a tap goes straight through to the real handler.
 *
 * Scope: RN APIs the mobile food-search / copy-meal / duplicate-day /
 * hydration-stimulants components actually import. Kept deliberately
 * small — adding more here should be a deliberate choice, not a blanket
 * "mock everything" because that hides drift between the mock and the
 * real RN API surface.
 */
import * as React from "react";

type AnyProps = Record<string, unknown> & { children?: React.ReactNode };

function hostForwarder(type: string) {
  const Cmp = React.forwardRef<unknown, AnyProps>(function Host(props, ref) {
    // React treats a string type as a host component, so the resulting
    // ReactTestInstance has `instance.type === "View" | "Text" | …` which
    // is exactly what RNTL's host-name helpers look for.
    return React.createElement(type, { ...props, ref });
  });
  Cmp.displayName = type;
  return Cmp;
}

export const View = hostForwarder("View");
export const Text = hostForwarder("Text");
// RNTL recognises press-responding Pressable because it walks the tree
// looking for `onStartShouldSetResponder` / `onPress`. Forwarding props
// to a host "View" element is the simplest way to stay compatible.
export const Pressable = hostForwarder("View");
export const TouchableOpacity = hostForwarder("View");
export const TouchableWithoutFeedback = hostForwarder("View");
export const TextInput = hostForwarder("TextInput");
export const Image = hostForwarder("Image");
export const ActivityIndicator = hostForwarder("ActivityIndicator");
// RNTL's host-scroll-view matcher expects `"RCTScrollView"`, not "ScrollView".
export const ScrollView = hostForwarder("RCTScrollView");
export const FlatList = React.forwardRef<unknown, AnyProps>(function FlatList(
  props,
  ref,
) {
  // Render each data item through renderItem so the tests can interact
  // with the resulting rows. Supports the subset of props the mobile
  // components pass (data, keyExtractor, renderItem, ListEmptyComponent,
  // ListFooterComponent, contentContainerStyle).
  const {
    data,
    renderItem,
    keyExtractor,
    ListEmptyComponent,
    ListFooterComponent,
    ...rest
  } = props as {
    data?: readonly unknown[];
    renderItem?: (info: { item: unknown; index: number }) => React.ReactNode;
    keyExtractor?: (item: unknown, index: number) => string;
    ListEmptyComponent?: React.ReactNode;
    ListFooterComponent?: React.ReactNode;
  } & AnyProps;

  const rows: React.ReactNode[] = [];
  if (Array.isArray(data) && data.length > 0 && renderItem) {
    data.forEach((item, index) => {
      const node = renderItem({ item, index });
      const key = keyExtractor ? keyExtractor(item, index) : String(index);
      rows.push(React.createElement(React.Fragment, { key }, node));
    });
  } else if (ListEmptyComponent) {
    rows.push(
      typeof ListEmptyComponent === "function"
        ? React.createElement(ListEmptyComponent as React.ComponentType)
        : ListEmptyComponent,
    );
  }
  if (ListFooterComponent) {
    rows.push(
      typeof ListFooterComponent === "function"
        ? React.createElement(ListFooterComponent as React.ComponentType)
        : ListFooterComponent,
    );
  }
  return React.createElement(
    "View",
    { ...rest, ref, "data-testid-host": "FlatList" },
    ...rows,
  );
});
(FlatList as unknown as { displayName: string }).displayName = "FlatList";

export const Modal = React.forwardRef<unknown, AnyProps>(function Modal(props, ref) {
  const { visible, children, ...rest } = props as {
    visible?: boolean;
    children?: React.ReactNode;
  } & AnyProps;
  // Real RN Modal renders children only when visible. Preserve that so
  // a test that asserts "nothing rendered when closed" remains honest.
  if (visible === false) return null;
  return React.createElement("Modal", { ...rest, ref }, children);
});
(Modal as unknown as { displayName: string }).displayName = "Modal";

export const KeyboardAvoidingView = hostForwarder("View");
export const SafeAreaView = hostForwarder("View");
export const Switch = hostForwarder("RCTSwitch");

/** Alert — only `.alert` / `.prompt` statics are used in the components
 *  under test. `.alert` in tests is a no-op spy; components should not
 *  block on confirmations during a render test. */
export const Alert = {
  alert: (..._args: unknown[]) => undefined,
  prompt: (..._args: unknown[]) => undefined,
};

/** StyleSheet — RNTL itself calls `StyleSheet.flatten` inside
 *  `helpers/map-props.js`, so this must behave like the real one. */
export const StyleSheet = {
  create<T extends Record<string, unknown>>(obj: T): T {
    return obj;
  },
  flatten(style: unknown): Record<string, unknown> | undefined {
    if (style == null) return undefined;
    if (Array.isArray(style)) {
      const out: Record<string, unknown> = {};
      for (const s of style) {
        const merged = StyleSheet.flatten(s);
        if (merged) Object.assign(out, merged);
      }
      return out;
    }
    if (typeof style === "object") return style as Record<string, unknown>;
    return undefined;
  },
  hairlineWidth: 1,
  absoluteFill: {},
  absoluteFillObject: {},
};

export const Platform = {
  OS: "ios" as const,
  select<T>(specifics: { ios?: T; android?: T; default?: T }): T | undefined {
    return specifics.ios ?? specifics.default;
  },
  Version: "17.0",
};

export const Dimensions = {
  get(): { width: number; height: number; scale: number; fontScale: number } {
    return { width: 390, height: 844, scale: 2, fontScale: 1 };
  },
  addEventListener(): { remove: () => void } {
    return { remove: () => undefined };
  },
};

export const useColorScheme = (): "light" | "dark" => "dark";

/** AppState — referenced transitively by some providers; safe no-op. */
export const AppState = {
  currentState: "active" as const,
  addEventListener(): { remove: () => void } {
    return { remove: () => undefined };
  },
};

/** Keyboard — no-op shim used by a handful of screens transitively. */
export const Keyboard = {
  dismiss: () => undefined,
  addListener: () => ({ remove: () => undefined }),
};

/** Linking — some helpers import but our tests never exercise it. */
export const Linking = {
  openURL: async (_url: string) => undefined,
  canOpenURL: async (_url: string) => false,
  addEventListener: () => ({ remove: () => undefined }),
  getInitialURL: async () => null,
};

/** AccessibilityInfo — some components read reduce-motion on mount. */
export const AccessibilityInfo = {
  isReduceMotionEnabled: async () => false,
  isScreenReaderEnabled: async () => false,
  announceForAccessibility: () => undefined,
  setAccessibilityFocus: () => undefined,
  addEventListener: () => ({ remove: () => undefined }),
};

export function findNodeHandle(_ref: unknown): number | null {
  return null;
}

/** Animated — minimal stub. Sufficient for SkeletonRow's opacity loop
 *  + Animated.View pass-through. Real animations are skipped under
 *  vitest (we only render once and assert structure). */
class AnimatedValue {
  _value: number;
  constructor(initial: number) {
    this._value = initial;
  }
  setValue(v: number): void {
    this._value = v;
  }
  interpolate(): this {
    return this;
  }
  addListener(): string {
    return "0";
  }
  removeListener(): void {}
  removeAllListeners(): void {}
}

function noopAnim() {
  return {
    start: (cb?: (info: { finished: boolean }) => void) =>
      cb?.({ finished: true }),
    stop: () => undefined,
    reset: () => undefined,
  };
}

export const Animated = {
  Value: AnimatedValue,
  View,
  Text,
  Image,
  ScrollView,
  timing: noopAnim,
  spring: noopAnim,
  decay: noopAnim,
  sequence: noopAnim,
  parallel: noopAnim,
  loop: noopAnim,
  delay: noopAnim,
  stagger: noopAnim,
  createAnimatedComponent: <T,>(Component: T) => Component,
  event: () => () => undefined,
};

export const Easing = {
  linear: (t: number) => t,
  ease: (t: number) => t,
  in: (fn: (t: number) => number) => fn,
  out: (fn: (t: number) => number) => fn,
  inOut: (fn: (t: number) => number) => fn,
  bezier: () => (t: number) => t,
};

export const PixelRatio = {
  get: () => 2,
  getFontScale: () => 1,
  roundToNearestPixel: (x: number) => Math.round(x),
};

export default {
  View,
  Text,
  Pressable,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  Image,
  ActivityIndicator,
  ScrollView,
  FlatList,
  Modal,
  KeyboardAvoidingView,
  SafeAreaView,
  Switch,
  Alert,
  StyleSheet,
  Platform,
  Dimensions,
  useColorScheme,
  AppState,
  Keyboard,
  Linking,
  AccessibilityInfo,
  findNodeHandle,
  PixelRatio,
  Animated,
  Easing,
};
