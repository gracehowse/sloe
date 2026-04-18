/**
 * `react-native-safe-area-context` shim — tests render outside a
 * SafeAreaProvider, so we return a static inset and a pass-through
 * Provider so components stay mountable.
 */
import * as React from "react";

const DEFAULT_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

export function useSafeAreaInsets() {
  return DEFAULT_INSETS;
}

export function useSafeAreaFrame() {
  return { x: 0, y: 0, width: 390, height: 844 };
}

export function SafeAreaProvider({
  children,
}: {
  children?: React.ReactNode;
}) {
  return React.createElement(React.Fragment, null, children);
}

export function SafeAreaView({ children, ...rest }: { children?: React.ReactNode } & Record<string, unknown>) {
  return React.createElement("View", rest, children);
}

export const SafeAreaInsetsContext = React.createContext(DEFAULT_INSETS);
export const SafeAreaFrameContext = React.createContext({
  x: 0,
  y: 0,
  width: 390,
  height: 844,
});

export default {
  useSafeAreaInsets,
  useSafeAreaFrame,
  SafeAreaProvider,
  SafeAreaView,
  SafeAreaInsetsContext,
  SafeAreaFrameContext,
};
