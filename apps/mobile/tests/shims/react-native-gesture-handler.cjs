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
  // Expose both the children and any right-action renderer so tests
  // that assert on the swipe row shape still see the delete button —
  // but for F-17 we only assert on the slot header so rendering
  // children is sufficient.
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
  State: {},
  Directions: {},
  gestureHandlerRootHOC: (Component) => Component,
};
