/**
 * Minimal `react-native` shim for vitest + `@testing-library/react-native`
 * (RNTL, 2026-04-18 / post-ship #3).
 *
 * Why this exists
 * ---------------
 * Expo / React Native's `react-native` package entry uses Flow syntax
 * and native-only globals (`__DEV__`, `nativeFabricUIManager`, etc.) so
 * it cannot be loaded by Node / vitest directly. `jest-expo` solves
 * this under jest; we stay on vitest (matching the existing mobile
 * test runner at `apps/mobile/vitest.config.ts`) and patch Node's CJS
 * resolver (`Module._resolveFilename` in `tests/setup.ts`) to route
 * `require("react-native")` to this file instead.
 *
 * Why this file is CJS (`.cjs`), not TSX
 * --------------------------------------
 * Node's CJS loader runs before vite-node can transform the file, so
 * the shim MUST be syntactically valid from Node's point of view. TSX
 * / ESM would fail with `"Cannot use import statement outside a module"`.
 * A plain CJS module with `exports.X = ...` is universally loadable.
 *
 * What it guarantees
 * ------------------
 * Every component the three render-level tests touch gets a host
 * string type that RNTL recognises (`"View"`, `"Text"`, `"Modal"`, …).
 * RNTL's `fireEvent.press` looks for `props.onPress` on a host element,
 * so every component here forwards props verbatim to a host element
 * with the right type name — a tap goes straight through to the real
 * handler.
 *
 * Scope: RN APIs the mobile food-search / copy-meal / duplicate-day /
 * hydration-stimulants components actually import. Kept deliberately
 * small — adding more here should be a deliberate choice, not a
 * blanket "mock everything" because that hides drift between the mock
 * and the real RN API surface.
 */
"use strict";

const React = require("react");

function hostForwarder(type) {
  const Cmp = React.forwardRef(function Host(props, ref) {
    // React treats a string type as a host component, so the resulting
    // ReactTestInstance has `instance.type === "View" | "Text" | …` —
    // which is exactly what RNTL's host-name helpers look for.
    return React.createElement(type, Object.assign({}, props, { ref }));
  });
  Cmp.displayName = type;
  return Cmp;
}

const View = hostForwarder("View");
const Text = hostForwarder("Text");
// RNTL recognises press-responding Pressable because it walks the
// tree looking for `onStartShouldSetResponder` / `onPress`. Forwarding
// props to a host "View" element is the simplest way to stay compatible.
const Pressable = hostForwarder("View");
const TouchableOpacity = hostForwarder("View");
const TouchableWithoutFeedback = hostForwarder("View");
const TextInput = hostForwarder("TextInput");
const Image = hostForwarder("Image");
const ActivityIndicator = hostForwarder("ActivityIndicator");
// RNTL's host-scroll-view matcher expects `"RCTScrollView"`, not "ScrollView".
const ScrollView = hostForwarder("RCTScrollView");

const FlatList = React.forwardRef(function FlatList(props, ref) {
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
    // strip non-visual props that would otherwise leak onto the host
    horizontal,
    showsHorizontalScrollIndicator,
    showsVerticalScrollIndicator,
    keyboardShouldPersistTaps,
    contentContainerStyle,
    initialNumToRender,
    maxToRenderPerBatch,
    windowSize,
    getItemLayout,
    ...rest
  } = props;
  void horizontal;
  void showsHorizontalScrollIndicator;
  void showsVerticalScrollIndicator;
  void keyboardShouldPersistTaps;
  void contentContainerStyle;
  void initialNumToRender;
  void maxToRenderPerBatch;
  void windowSize;
  void getItemLayout;

  const rows = [];
  if (Array.isArray(data) && data.length > 0 && renderItem) {
    data.forEach((item, index) => {
      const node = renderItem({ item, index });
      const key = keyExtractor ? keyExtractor(item, index) : String(index);
      rows.push(React.createElement(React.Fragment, { key }, node));
    });
  } else if (ListEmptyComponent) {
    rows.push(
      typeof ListEmptyComponent === "function"
        ? React.createElement(ListEmptyComponent)
        : ListEmptyComponent,
    );
  }
  if (ListFooterComponent) {
    rows.push(
      typeof ListFooterComponent === "function"
        ? React.createElement(ListFooterComponent)
        : ListFooterComponent,
    );
  }
  return React.createElement(
    "View",
    Object.assign({}, rest, { ref }),
    ...rows,
  );
});
FlatList.displayName = "FlatList";

const Modal = React.forwardRef(function Modal(props, ref) {
  const { visible, children, ...rest } = props;
  // Real RN Modal renders children only when visible. Preserve that so
  // a test asserting "nothing rendered when closed" stays honest.
  if (visible === false) return null;
  return React.createElement(
    "Modal",
    Object.assign({}, rest, { ref }),
    children,
  );
});
Modal.displayName = "Modal";

const KeyboardAvoidingView = hostForwarder("View");
const SafeAreaView = hostForwarder("View");
const Switch = hostForwarder("RCTSwitch");

/** Alert — only `.alert` / `.prompt` statics are used in the
 *  components under test. `.alert` in tests is a no-op spy; components
 *  should not block on confirmations during a render test. */
const Alert = {
  alert: function noopAlert() {
    return undefined;
  },
  prompt: function noopPrompt() {
    return undefined;
  },
};

/** StyleSheet — RNTL itself calls `StyleSheet.flatten` inside
 *  `helpers/map-props.js`, so this must behave like the real one. */
const StyleSheet = {
  create: function create(obj) {
    return obj;
  },
  flatten: function flatten(style) {
    if (style == null) return undefined;
    if (Array.isArray(style)) {
      const out = {};
      for (const s of style) {
        const merged = StyleSheet.flatten(s);
        if (merged) Object.assign(out, merged);
      }
      return out;
    }
    if (typeof style === "object") return style;
    return undefined;
  },
  hairlineWidth: 1,
  absoluteFill: {},
  absoluteFillObject: {},
};

const Platform = {
  OS: "ios",
  select: function platformSelect(specifics) {
    if (!specifics) return undefined;
    return Object.prototype.hasOwnProperty.call(specifics, "ios")
      ? specifics.ios
      : specifics.default;
  },
  Version: "17.0",
};

const Dimensions = {
  get: function getDim() {
    return { width: 390, height: 844, scale: 2, fontScale: 1 };
  },
  addEventListener: function addDim() {
    return { remove: function removeDim() {} };
  },
};

function useColorScheme() {
  return "dark";
}

const AppState = {
  currentState: "active",
  addEventListener: function addAppState() {
    return { remove: function removeAppState() {} };
  },
};

const Keyboard = {
  dismiss: function dismiss() {},
  addListener: function addListener() {
    return { remove: function removeKbd() {} };
  },
};

const Linking = {
  openURL: async function openURL() {},
  canOpenURL: async function canOpenURL() {
    return false;
  },
  addEventListener: function addLinking() {
    return { remove: function removeLinking() {} };
  },
  getInitialURL: async function getInitial() {
    return null;
  },
};

const AccessibilityInfo = {
  isReduceMotionEnabled: async function isReduceMotion() {
    return false;
  },
  isScreenReaderEnabled: async function isScreenReader() {
    return false;
  },
  announceForAccessibility: function announce() {},
  setAccessibilityFocus: function setFocus() {},
  addEventListener: function addA11y() {
    return { remove: function removeA11y() {} };
  },
};

function findNodeHandle() {
  return null;
}

/** Legacy `Touchable` mixin. `react-native-svg` imports `Touchable.Mixin`
 *  on module load — add a stub so transitive loads don't crash. The mixin
 *  is never used in tests; `Pressable` (above) handles tap flow. */
const Touchable = {
  Mixin: {},
};

const PixelRatio = {
  get: function getRatio() {
    return 2;
  },
  getFontScale: function getFontScale() {
    return 1;
  },
  roundToNearestPixel: function roundPx(x) {
    return Math.round(x);
  },
};

const reactNative = {
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
  Touchable,
};

module.exports = reactNative;
module.exports.default = reactNative;
// Named re-exports so ESM `import { View } from "react-native"` works
// after esbuild's CJS interop.
Object.assign(module.exports, reactNative);
