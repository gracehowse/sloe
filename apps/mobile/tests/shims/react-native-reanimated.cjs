/**
 * Vitest shim for react-native-reanimated.
 *
 * Reanimated ships with a Babel-time worklets plugin and native binding
 * via `react-native-worklets`. Both blow up under the vmThreads pool
 * we use for vitest. This shim provides the minimum surface — shared
 * values, timing/spring tweens, animated style hook, animated component
 * wrapper — so unit tests can mount components that import reanimated
 * without exercising any animation logic.
 *
 * The shape mirrors `react-native-reanimated` exports used by:
 *   - `apps/mobile/components/ui/PressableScale.tsx`
 *   - `apps/mobile/components/charts/CalorieRing.tsx`
 * Consumers that read `.value` synchronously get the latest assigned
 * value; consumers that pass an object to `useAnimatedStyle` get the
 * raw evaluator output (transforms / opacity / etc.) flattened into
 * the style array.
 */
"use strict";

const React = require("react");

function useSharedValue(initial) {
  const ref = React.useRef({ value: initial });
  return ref.current;
}

function withTiming(target, _config, callback) {
  if (typeof callback === "function") callback(true);
  return target;
}

function withSpring(target, _config, callback) {
  if (typeof callback === "function") callback(true);
  return target;
}

function withSequence(...values) {
  return values[values.length - 1];
}

function withRepeat(target) {
  return target;
}

function withDelay(_delay, target) {
  return target;
}

function useAnimatedStyle(factory, _deps) {
  try {
    return factory();
  } catch {
    return {};
  }
}

function useAnimatedProps(factory, _deps) {
  try {
    return factory();
  } catch {
    return {};
  }
}

function useDerivedValue(factory) {
  try {
    return { value: factory() };
  } catch {
    return { value: 0 };
  }
}

function runOnJS(fn) {
  return fn;
}

function runOnUI(fn) {
  return fn;
}

function createAnimatedComponent(Component) {
  return React.forwardRef(function AnimatedComponent(props, ref) {
    return React.createElement(Component, { ...props, ref });
  });
}

const Easing = {
  linear: (t) => t,
  ease: (t) => t,
  bezier: () => (t) => t,
  out: (fn) => fn,
  in: (fn) => fn,
  inOut: (fn) => fn,
  cubic: (t) => t,
};

// 2026-05-12 (premium-bar audit motion polish): components that render
// `<Animated.View>` directly need a real React component, not a JSX-
// type string. Strings like "Animated.View" worked in tests that only
// `mount + find by testID`, but react-test-renderer throws
// "Element type is invalid" once a component tries to render the
// returned identifier as a JSX element type. Wrap each primitive in a
// forwardRef that just renders to the corresponding RN host string
// ("View" / "Text" / "ScrollView") — matching the RN shim's
// `hostForwarder` pattern in `tests/shims/react-native.cjs`. RNTL
// + react-test-renderer both find these by host-type name.
function reanimatedHostForwarder(type, displayName) {
  const Cmp = React.forwardRef(function Animated(props, ref) {
    return React.createElement(type, Object.assign({}, props, { ref }));
  });
  Cmp.displayName = displayName;
  return Cmp;
}

const Animated = {
  View: reanimatedHostForwarder("View", "Animated.View"),
  Text: reanimatedHostForwarder("Text", "Animated.Text"),
  ScrollView: reanimatedHostForwarder("ScrollView", "Animated.ScrollView"),
  createAnimatedComponent,
};

function layoutEntering() {
  const chain = {
    delay: () => chain,
    duration: () => chain,
    springify: () => chain,
  };
  return chain;
}

const FadeInDown = layoutEntering();
const FadeIn = layoutEntering();
const FadeOut = layoutEntering();
const FadeOutDown = layoutEntering();
const SlideInDown = layoutEntering();
const SlideOutDown = layoutEntering();

function useReducedMotion() {
  return false;
}

module.exports = Animated;
module.exports.__esModule = true;
module.exports.default = Animated;
module.exports.Animated = Animated;
module.exports.FadeInDown = FadeInDown;
module.exports.FadeIn = FadeIn;
module.exports.FadeOut = FadeOut;
module.exports.FadeOutDown = FadeOutDown;
module.exports.SlideInDown = SlideInDown;
module.exports.SlideOutDown = SlideOutDown;
module.exports.useSharedValue = useSharedValue;
module.exports.useAnimatedStyle = useAnimatedStyle;
module.exports.useAnimatedProps = useAnimatedProps;
module.exports.useDerivedValue = useDerivedValue;
module.exports.withTiming = withTiming;
module.exports.withSpring = withSpring;
module.exports.withSequence = withSequence;
module.exports.withRepeat = withRepeat;
module.exports.withDelay = withDelay;
module.exports.runOnJS = runOnJS;
module.exports.runOnUI = runOnUI;
module.exports.Easing = Easing;
module.exports.createAnimatedComponent = createAnimatedComponent;
module.exports.useReducedMotion = useReducedMotion;
