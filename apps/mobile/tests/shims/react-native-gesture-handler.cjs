"use strict";

/**
 * Minimal `react-native-gesture-handler` shim for vitest render tests.
 *
 * The real package loads native spec modules (`./specs/NativeRNGestureHandlerModule`)
 * at import time which don't exist in a Node test runtime. Render tests
 * that mount `Swipeable` — e.g. `TodayMealsSection` — only need the
 * component to forward children so RNTL can walk the tree. Every
 * pressable inside the meal row still resolves via the `react-native`
 * shim's host types; none of the pan/drag logic actually runs.
 */

const React = require("react");

function passthrough(name) {
  return function Comp(props) {
    return React.createElement(React.Fragment, null, props.children);
  };
}

const Swipeable = function Swipeable(props) {
  const right = props.renderRightActions ? props.renderRightActions() : null;
  return React.createElement(React.Fragment, null, props.children, right);
};

// New gesture-handler API (Gesture.Pan(), GestureDetector) used by
// `RulerSlider` and any future net-new primitive. Tests only need the
// builder to be chainable and the detector to render children — no
// pan/drag handling actually fires.
function makeChainableGesture() {
  const noop = () => builder; // eslint-disable-line @typescript-eslint/no-use-before-define
  const builder = {
    onBegin: noop,
    onStart: noop,
    onChange: noop,
    onUpdate: noop,
    onEnd: noop,
    onFinalize: noop,
    minDistance: noop,
    activeOffsetX: noop,
    activeOffsetY: noop,
    failOffsetX: noop,
    failOffsetY: noop,
    enabled: noop,
    runOnJS: noop,
  };
  return builder;
}

const Gesture = {
  Pan: makeChainableGesture,
  Tap: makeChainableGesture,
  LongPress: makeChainableGesture,
  Pinch: makeChainableGesture,
  Rotation: makeChainableGesture,
  Fling: makeChainableGesture,
  Native: makeChainableGesture,
  Manual: makeChainableGesture,
  Race: () => makeChainableGesture(),
  Simultaneous: () => makeChainableGesture(),
  Exclusive: () => makeChainableGesture(),
};

const GestureDetector = function GestureDetector(props) {
  return React.createElement(React.Fragment, null, props.children);
};

module.exports = {
  __esModule: true,
  Swipeable,
  default: Swipeable,
  GestureHandlerRootView: passthrough("GestureHandlerRootView"),
  PanGestureHandler: passthrough("PanGestureHandler"),
  TapGestureHandler: passthrough("TapGestureHandler"),
  LongPressGestureHandler: passthrough("LongPressGestureHandler"),
  GestureDetector,
  Gesture,
  State: {},
  Directions: {},
  gestureHandlerRootHOC: (Component) => Component,
};
